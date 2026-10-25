from typing import Annotated

from fastapi import APIRouter, Query

from app.dependencies import DeliveryServiceDep
from app.schemas.deliveries import DeliveryFilters, DeliveryOverview

router = APIRouter(prefix="/deliveries", tags=["Entregas"])


@router.get(
    "/overview",
    response_model=DeliveryOverview,
    summary="Indicadores de entrega e mapa de calor",
    description=(
        "Retorna total de pedidos, atrasos, taxa de atraso e tempo médio de entrega. "
        "Sem `city`, o mapa traz um ponto por cidade do Brasil; com `city` + `state`, "
        "um ponto por prefixo de CEP dentro da cidade."
    ),
)
def get_overview(
    filters: Annotated[DeliveryFilters, Query()],
    service: DeliveryServiceDep,
):
    return service.get_overview(filters)