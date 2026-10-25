import pandas as pd

from app.repositories.city_repository import CityRepository
from app.repositories.delivery_repository import DeliveryRepository
from app.schemas.cities import City
from app.schemas.routes import CriticalRoute, CriticalRouteFilters, CriticalRoutes
from app.services.city_service import get_city_or_raise


class RouteService:
    def __init__(self, delivery_repository: DeliveryRepository, city_repository: CityRepository):
        self._deliveries = delivery_repository
        self._cities = city_repository

    def get_critical_routes(self, filters: CriticalRouteFilters) -> CriticalRoutes:
        destination = get_city_or_raise(self._cities, filters.city_id)

        rows = self._deliveries.find(
            start_date=filters.start_date,
            end_date=filters.end_date,
            destination_city_id=filters.city_id,
        )
        # Rota = cidade do vendedor -> cidade do cliente. Um pedido com 2 vendedores da
        # MESMA cidade conta 1 vez nessa rota; de cidades diferentes, 1 vez em cada rota.
        rows = rows.drop_duplicates(["order_id", "seller_city_id"])

        ranking = self._rank(rows, filters.min_orders, filters.limit)
        origins = self._origins_by_id(ranking["seller_city_id"])

        routes = [
            CriticalRoute(
                rank=position,
                origin=origins[int(row.seller_city_id)],
                total_orders=int(row.total_orders),
                delayed_orders=int(row.delayed_orders),
                delay_rate=round(row.delay_rate * 100, 2),
                avg_delivery_days=round(row.avg_delivery_days, 1),
                avg_delay_days=None if pd.isna(row.avg_delay_days) else round(row.avg_delay_days, 1),
            )
            for position, row in enumerate(ranking.itertuples(), start=1)
        ]
        return CriticalRoutes(destination=destination, routes=routes)

    # ------------------------------------------------------------ auxiliares
    @staticmethod
    def _rank(rows: pd.DataFrame, min_orders: int, limit: int) -> pd.DataFrame:
        # Dias de atraso só dos pedidos atrasados (os demais viram NaN e são ignorados na média)
        rows = rows.assign(delay_when_late=rows["delay_days"].where(rows["is_delayed"]))

        grouped = rows.groupby("seller_city_id", as_index=False).agg(
            total_orders=("order_id", "size"),
            delayed_orders=("is_delayed", "sum"),
            avg_delivery_days=("delivery_days", "mean"),
            avg_delay_days=("delay_when_late", "mean"),
        )
         # Só entram rotas com volume mínimo E pelo menos 1 atraso (rota sem atraso não é crítica)
        grouped = grouped[(grouped["total_orders"] >= min_orders) & (grouped["delayed_orders"] > 0)]
        grouped = grouped.assign(delay_rate=grouped["delayed_orders"] / grouped["total_orders"])

        # Mais crítica = maior taxa de atraso; empate -> mais dias de atraso -> mais pedidos
        return grouped.sort_values(
            ["delay_rate", "avg_delay_days", "total_orders"],
            ascending=False,
        ).head(limit)

    def _origins_by_id(self, city_ids) -> dict[int, City]:
        cities = self._cities.find_by_ids(city_ids)
        return {int(row["city_id"]): City.model_validate(row) for row in cities.to_dict("records")}