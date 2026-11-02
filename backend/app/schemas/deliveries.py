from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.cities import City


# ---------- Entrada ----------
class DeliveryFilters(BaseModel):
    start_date: date | None = Field(None, description="Início do período (data da compra)")
    end_date: date | None = Field(None, description="Fim do período (inclusivo)")
    city_id: int | None = Field(None, ge=1, description="Cidade de destino (GET /cities). Vazio = Brasil todo")
    min_orders: int = Field(5, ge=1, description="Mínimo de pedidos para um ponto aparecer no mapa")

    @model_validator(mode="after")
    def _check_period(self):
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("'start_date' deve ser menor ou igual a 'end_date'")
        return self


# ---------- Saída ----------
class DeliverySummary(BaseModel):
    total_orders: int
    delayed_orders: int
    delay_rate: float = Field(description="Percentual de pedidos atrasados (0-100)")
    avg_delivery_days: float | None = Field(description="Tempo médio entre compra e entrega, em dias")


class HeatmapPoint(BaseModel):
    lat: float
    lng: float
    weight: float = Field(description="Intensidade do ponto (0-1) = taxa de atraso")
    label: str
    city_id: int | None = Field(None, description="Preenchido no nível 'city'")
    total_orders: int
    delay_rate: float


class Heatmap(BaseModel):
    level: Literal["city", "zip_prefix"]
    points: list[HeatmapPoint]


class DeliveryOverview(BaseModel):
    city: City | None = Field(description="Cidade selecionada; null = Brasil todo")
    summary: DeliverySummary
    heatmap: Heatmap