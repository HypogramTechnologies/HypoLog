from fastapi import APIRouter

from app.dependencies import SimulationServiceDep
from app.schemas.simulations import SimulationRequest, SimulationResult

router = APIRouter(prefix="/simulations", tags=["Simulador"])


@router.post(
    "",
    response_model=SimulationResult,
    summary="Simula o risco de atraso de um novo envio",
    description=(
        "Recebe origem, destino, características do pacote (peso, dimensões, itens), o prazo "
        "prometido e, opcionalmente, a data da compra, e devolve a probabilidade estimada de "
        "atraso, o nível de risco e os fatores que o explicam. A estimativa vem de um modelo de "
        "ML (Gradient Boosting) treinado com a base da Olist: a probabilidade é a chance de a "
        "entrega levar mais dias do que o prazo informado e diminui conforme o prazo aumenta. "
        "Cada cidade é dividida em zonas por faixa de CEP (mais zonas nas cidades maiores). "
        "Se o modelo não estiver treinado, a API usa um baseline histórico de distância e prazo. "
        "O campo `model` informa qual estimador respondeu."
    ),
)
def simulate_shipment(payload: SimulationRequest, service: SimulationServiceDep):
    return service.simulate(payload)