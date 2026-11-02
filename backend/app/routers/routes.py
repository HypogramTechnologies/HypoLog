from typing import Annotated

from fastapi import APIRouter, Query

from app.dependencies import RouteServiceDep
from app.schemas.routes import CriticalRouteFilters, CriticalRoutes

router = APIRouter(prefix="/routes", tags=["Rotas"])


@router.get(
    "/critical",
    response_model=CriticalRoutes,
    summary="Rotas mais críticas até uma cidade de destino",
    description=(
        "Ranqueia as cidades de origem (vendedores) que enviam para a cidade de destino, "
        "da maior para a menor taxa de atraso. Entram apenas rotas com pelo menos "
        "`min_orders` pedidos e ao menos 1 atraso. Empates são decididos pela média de "
        "dias de atraso e, depois, pelo volume de pedidos."
    ),
)
def get_critical_routes(
    filters: Annotated[CriticalRouteFilters, Query()],
    service: RouteServiceDep,
):
    return service.get_critical_routes(filters)