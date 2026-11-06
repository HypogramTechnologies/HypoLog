from contextlib import asynccontextmanager

import pandas as pd
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.exceptions import NotFoundError
from app.routers import cities, deliveries, routes, reports


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Executa UMA vez, quando a API sobe
    app.state.deliveries = pd.read_parquet(settings.deliveries_file)
    app.state.cities = pd.read_parquet(settings.cities_file)
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
    return JSONResponse(
        status_code=404,
        content={"detail": str(exc)}
    )


@app.get("/health", tags=["Health"])
def health():
    return {
        "status": "ok",
        "deliveries": len(app.state.deliveries),
        "cities": len(app.state.cities),
    }


app.include_router(cities.router, prefix=settings.api_prefix)
app.include_router(deliveries.router, prefix=settings.api_prefix)
app.include_router(routes.router, prefix=settings.api_prefix)
app.include_router(reports.router, prefix=settings.api_prefix)
