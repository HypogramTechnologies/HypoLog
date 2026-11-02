from typing import Annotated

from fastapi import APIRouter, Query

from app.dependencies import CityServiceDep
from app.schemas.cities import City, CityFilters

router = APIRouter(prefix="/cities", tags=["Cidades"])


@router.get(
    "",
    response_model=list[City],
    summary="Cidades de destino",
    description="Lista as cidades que receberam pedidos. A busca ignora acentos e maiúsculas.",
)
def list_cities(
    filters: Annotated[CityFilters, Query()],
    service: CityServiceDep,
):
    return service.list_destinations(filters)