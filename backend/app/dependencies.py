from typing import Annotated

from fastapi import Depends, Request

from app.core.exceptions import ModelUnavailableError

from app.repositories.city_repository import CityRepository
from app.repositories.delivery_repository import DeliveryRepository
from app.services.city_service import CityService
from app.services.delivery_service import DeliveryService
from app.services.prediction_service import PredictionService
from app.services.route_service import RouteService
from app.services.simulation_service import SimulationService


# ---------- Repositories ----------
def get_delivery_repository(request: Request) -> DeliveryRepository:
    return DeliveryRepository(request.app.state.deliveries)


def get_city_repository(request: Request) -> CityRepository:
    return CityRepository(request.app.state.cities)


# ---------- Modelo de ML ----------
def get_delay_model(request: Request) -> dict:
    artifact = request.app.state.delay_model
    if artifact is None:
        raise ModelUnavailableError()
    return artifact


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


def get_prediction_service(
    artifact: Annotated[dict, Depends(get_delay_model)],
    city_repository: Annotated[CityRepository, Depends(get_city_repository)],
) -> PredictionService:
    return PredictionService(artifact, city_repository)


def get_simulation_service(request: Request) -> SimulationService:
    # Localizador de CEP e estimador de risco são construídos uma vez, no startup (main.py)
    return SimulationService(request.app.state.zip_locator, request.app.state.risk_predictor)


# ---------- Atalhos para os routers ----------
DeliveryServiceDep = Annotated[DeliveryService, Depends(get_delivery_service)]
CityServiceDep = Annotated[CityService, Depends(get_city_service)]
RouteServiceDep = Annotated[RouteService, Depends(get_route_service)]
PredictionServiceDep = Annotated[PredictionService, Depends(get_prediction_service)]
SimulationServiceDep = Annotated[SimulationService, Depends(get_simulation_service)]