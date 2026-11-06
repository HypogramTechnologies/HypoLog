from fastapi import APIRouter

from app.dependencies import PredictionServiceDep
from app.schemas.predictions import PredictionRequest, PredictionResponse

router = APIRouter(prefix="/predictions", tags=["Predição"])


@router.post(
    "",
    response_model=PredictionResponse,
    summary="Prevê o risco de atraso de um envio",
    description=(
        "Recebe os dados de um envio e devolve a probabilidade de atraso, a faixa de risco "
        "(baixo, médio, alto) e o contexto da origem e do destino. Aceita qualquer CEP: se ele "
        "não estiver na base, é usado o CEP vizinho mais próximo (`exact_match = false`)."
    ),
)
def predict(request: PredictionRequest, service: PredictionServiceDep):
    return service.predict(request)
