from typing import Annotated

from fastapi import Depends, Request

from app.repositories.city_repository import CityRepository
from app.repositories.delivery_repository import DeliveryRepository
from app.services.city_service import CityService
from app.services.delivery_service import DeliveryService
from app.services.route_service import RouteService


# ---------- Repositories ----------
def get_delivery_repository(request: Request) -> DeliveryRepository:
    return DeliveryRepository(request.app.state.deliveries)


def get_city_repository(request: Request) -> CityRepository:
    return CityRepository(request.app.state.cities)


# ---------- Services ----------
def get_delivery_service(
    delivery_repository: Annotated[DeliveryRepository, Depends(get_delivery_repository)],
    city_repository: Annotated[CityRepository, Depends(get_city_repository)],
) -> DeliveryService:
    return DeliveryService(delivery_repository, city_repository)


def get_city_service(
    repository: Annotated[CityRepository, Depends(get_city_repository)],
) -> CityService:
    return CityService(repository)

def get_route_service(
    delivery_repository: Annotated[DeliveryRepository, Depends(get_delivery_repository)],
    city_repository: Annotated[CityRepository, Depends(get_city_repository)],
) -> RouteService:
    return RouteService(delivery_repository, city_repository)

# ---------- Atalhos para os routers ----------
DeliveryServiceDep = Annotated[DeliveryService, Depends(get_delivery_service)]
CityServiceDep = Annotated[CityService, Depends(get_city_service)]
RouteServiceDep = Annotated[RouteService, Depends(get_route_service)]