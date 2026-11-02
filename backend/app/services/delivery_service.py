import pandas as pd

from app.repositories.city_repository import CityRepository
from app.repositories.delivery_repository import DeliveryRepository
from app.schemas.deliveries import (
    DeliveryFilters,
    DeliveryOverview,
    DeliverySummary,
    Heatmap,
    HeatmapPoint,
)
from app.services.city_service import get_city_or_raise

class DeliveryService:
    def __init__(self, delivery_repository: DeliveryRepository, city_repository: CityRepository):
        self._deliveries = delivery_repository
        self._cities = city_repository

    def get_overview(self, filters: DeliveryFilters) -> DeliveryOverview:
        city = get_city_or_raise(self._cities, filters.city_id) if filters.city_id else None

        rows = self._deliveries.find(
            start_date=filters.start_date,
            end_date=filters.end_date,
            destination_city_id=filters.city_id,
        )
        # A base tem 1 linha por (pedido, vendedor); aqui contamos pedidos
        orders = rows.drop_duplicates("order_id")

        heatmap = (
            self._heatmap_by_zip(orders, filters.min_orders)
            if city
            else self._heatmap_by_city(orders, filters.min_orders)
        )
        return DeliveryOverview(city=city, summary=self._build_summary(orders), heatmap=heatmap)

    # ------------------------------------------------------------ auxiliares
    @staticmethod
    def _build_summary(orders: pd.DataFrame) -> DeliverySummary:
        total = len(orders)
        delayed = int(orders["is_delayed"].sum())
        return DeliverySummary(
            total_orders=total,
            delayed_orders=delayed,
            delay_rate=round(delayed / total * 100, 2) if total else 0.0,
            avg_delivery_days=round(float(orders["delivery_days"].mean()), 1) if total else None,
        )

    @staticmethod
    def _aggregate(orders: pd.DataFrame, key: str, min_orders: int) -> pd.DataFrame:
        """Agrupa os pedidos por `key` e calcula coordenada, volume e taxa de atraso."""
        grouped = (
            orders.dropna(subset=["customer_lat", "customer_lng"])
            .groupby(key, as_index=False)
            .agg(
                lat=("customer_lat", "median"),
                lng=("customer_lng", "median"),
                total_orders=("order_id", "size"),
                delayed=("is_delayed", "sum"),
            )
        )
        grouped = grouped[grouped["total_orders"] >= min_orders]
        return grouped.assign(rate=grouped["delayed"] / grouped["total_orders"])

    @staticmethod
    def _to_point(row, label: str, city_id: int | None = None) -> HeatmapPoint:
        return HeatmapPoint(
            lat=round(row.lat, 5),
            lng=round(row.lng, 5),
            weight=round(row.rate, 4),
            label=label,
            city_id=city_id,
            total_orders=int(row.total_orders),
            delay_rate=round(row.rate * 100, 2),
        )

    def _heatmap_by_city(self, orders: pd.DataFrame, min_orders: int) -> Heatmap:
        """Brasil todo: 1 ponto por cidade de destino."""
        grouped = self._aggregate(orders, "customer_city_id", min_orders)

        names = self._cities.find_by_ids(grouped["customer_city_id"])[["city_id", "city_name", "state_code"]]
        grouped = grouped.merge(names, left_on="customer_city_id", right_on="city_id")

        points = [
            self._to_point(row, f"{row.city_name} ({row.state_code})", int(row.city_id))
            for row in grouped.itertuples()
        ]
        return Heatmap(level="city", points=points)

    def _heatmap_by_zip(self, orders: pd.DataFrame, min_orders: int) -> Heatmap:
        """Cidade selecionada: 1 ponto por prefixo de CEP."""
        grouped = self._aggregate(orders, "customer_zip_prefix", min_orders)
        points = [
            self._to_point(row, f"CEP {row.customer_zip_prefix:05d}-xxx")
            for row in grouped.itertuples()
        ]
        return Heatmap(level="zip_prefix", points=points)