import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator


# ---------- Entrada ----------
class PredictionRequest(BaseModel):
    origin_zip: str = Field(..., description="CEP de origem (vendedor), com ou sem traço", examples=["01310-100"])
    destination_zip: str = Field(..., description="CEP de destino (cliente), com ou sem traço", examples=["25010-000"])
    purchase_date: date | None = Field(None, description="Data da compra. Vazio = hoje")
    promised_days: int = Field(..., ge=1, le=120, description="Prazo prometido ao cliente, em dias", examples=[20])
    weight_g: float = Field(..., ge=0, le=200_000, description="Peso total do envio, em gramas", examples=[1500])
    length_cm: float = Field(..., gt=0, le=300, description="Comprimento do pacote, em cm", examples=[30])
    height_cm: float = Field(..., gt=0, le=300, description="Altura do pacote, em cm", examples=[20])
    width_cm: float = Field(..., gt=0, le=300, description="Largura do pacote, em cm", examples=[15])
    n_items: int = Field(1, ge=1, le=50, description="Quantidade de itens no envio")

    @field_validator("origin_zip", "destination_zip")
    @classmethod
    def _validate_zip(cls, value: str) -> str:
        digits = re.sub(r"\D", "", value)
        if len(digits) not in (5, 8):
            raise ValueError("CEP deve ter 8 dígitos (ou os 5 primeiros)")
        return digits

    @property
    def origin_prefix(self) -> int:
        return int(self.origin_zip[:5])

    @property
    def destination_prefix(self) -> int:
        return int(self.destination_zip[:5])


# ---------- Saída ----------
class LocationInfo(BaseModel):
    zip_prefix_used: str = Field(description="Prefixo de CEP usado no cálculo")
    exact_match: bool = Field(description="False = o CEP não estava na base e foi usado o vizinho mais próximo")
    city_name: str
    state_code: str


class DestinationInfo(LocationInfo):
    zone: int = Field(description="Zona da cidade (1 a 4), pelas faixas de CEP")
    zone_delay_rate: float = Field(description="Taxa histórica de atraso da zona (0-100)")


class RiskThresholds(BaseModel):
    medium: float = Field(description="Probabilidade mínima para risco médio (0-100)")
    high: float = Field(description="Probabilidade mínima para risco alto (0-100)")


class PredictionResponse(BaseModel):
    delay_probability: float = Field(description="Probabilidade de atraso (0-100)")
    risk_level: Literal["baixo", "medio", "alto"]
    likely_delayed: bool = Field(description="True quando a probabilidade atinge a faixa de risco alto")
    distance_km: float
    origin: LocationInfo
    destination: DestinationInfo
    thresholds: RiskThresholds
