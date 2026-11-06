import logging
from contextlib import asynccontextmanager

import joblib
import pandas as pd
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from app.core.config import settings
from app.core.exceptions import NotFoundError
from app.routers import cities, deliveries, routes, predictions, reports


logger = logging.getLogger("uvicorn.error")

def load_model():
    """Carrega o modelo treinado. Se o arquivo não existir, a API sobe sem a rota de predição."""
    if not settings.model_file.exists():
        logger.warning("Modelo não encontrado em %s. A rota /predictions responderá 503.", settings.model_file)
        return None
    artifact = joblib.load(settings.model_file)
    artifact["model"].n_jobs = 1  # uma previsão por vez: mais rápido sem abrir várias threads
    return artifact


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Executa UMA vez, quando a API sobe
    app.state.deliveries = pd.read_parquet(settings.deliveries_file)
    app.state.cities = pd.read_parquet(settings.cities_file)
    app.state.delay_model = load_model()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": exc.message})


@app.exception_handler(InvalidInputError)
async def invalid_input_handler(request: Request, exc: InvalidInputError):
    return JSONResponse(status_code=422, content={"detail": exc.message})


@app.exception_handler(ModelUnavailableError)
async def model_unavailable_handler(request: Request, exc: ModelUnavailableError):
    return JSONResponse(status_code=503, content={"detail": exc.message})


@app.get("/health", tags=["Health"])
def health():
    model = app.state.delay_model
    return {
        "status": "ok",
        "deliveries": len(app.state.deliveries),
        "cities": len(app.state.cities),
        "model_loaded": model is not None,
        "model_trained_at": model["report"]["trained_at"] if model else None,
    }

@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")

app.include_router(cities.router, prefix=settings.api_prefix)
app.include_router(deliveries.router, prefix=settings.api_prefix)
app.include_router(routes.router, prefix=settings.api_prefix)
app.include_router(reports.router, prefix=settings.api_prefix)
app.include_router(predictions.router, prefix=settings.api_prefix)