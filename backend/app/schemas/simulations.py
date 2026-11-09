from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# Menor prefixo de CEP existente no Brasil (01000-000, São Paulo)
MIN_ZIP_PREFIX = 1000


# ---------- Entrada ----------
class SimulationRequest(BaseModel):
    origin_zip: str = Field(..., description="CEP de origem, com ou sem hífen (ex.: '01001-000')")
    destination_zip: str = Field(..., description="CEP de destino, com ou sem hífen (ex.: '69005-010')")
    weight_kg: float = Field(..., gt=0, le=100, description="Peso do pacote, em kg")
    order_value: float = Field(..., ge=0, le=1_000_000, description="Valor do pedido, em R$")
    height_cm: float = Field(..., gt=0, le=200, description="Altura, em cm")
    width_cm: float = Field(..., gt=0, le=200, description="Largura, em cm")
    length_cm: float = Field(..., gt=0, le=200, description="Comprimento, em cm")
    estimated_days: int = Field(..., ge=1, le=120, description="Prazo prometido ao cliente, em dias corridos, contados da compra até a entrega (inclui o preparo do pedido pelo vendedor)")
    n_items: int = Field(1, ge=1, le=50, description="Quantidade de itens no envio")
    purchase_date: date | None = Field(None, description="Data da compra. Vazio = hoje")

    @field_validator("origin_zip", "destination_zip")
    @classmethod
    def _check_zip(cls, value: str) -> str:
        digits = value.strip().replace("-", "")
        if len(digits) != 8 or not digits.isdigit():
            raise ValueError("CEP deve ter 8 dígitos (ex.: 01001-000)")
        if int(digits[:5]) < MIN_ZIP_PREFIX:
            raise ValueError("CEP inexistente: o menor CEP do Brasil é 01000-000")
        return digits

    @property
    def origin_prefix(self) -> int:
        return int(self.origin_zip[:5])

    @property
    def destination_prefix(self) -> int:
        return int(self.destination_zip[:5])


# ---------- Saída ----------
class SimulationLocation(BaseModel):
    zip_code: str = Field(description="CEP informado, no formato 00000-000")
    city_name: str | None = Field(description="Cidade identificada para o CEP")
    state_code: str | None = Field(description="UF identificada para o CEP")
    zone: str | None = Field(
        default=None,
        description="Zona da cidade pela faixa de CEP (ex.: 'Zona 2 de 5'); cidades maiores têm mais zonas",
    )
    approximated: bool = Field(
        description="True quando o prefixo do CEP não existe na base e foi usada a região mais próxima"
    )


class RiskFactor(BaseModel):
    code: Literal["distance", "deadline", "destination_history", "destination_zone"]
    impact: Literal["raises", "lowers", "neutral"] = Field(description="Efeito do fator sobre o risco")
    label: str = Field(description="Explicação pronta para exibição")


class ModelInfo(BaseModel):
    kind: Literal["historical_baseline", "ml_model"] = Field(
        description="'historical_baseline' = estatística sobre o histórico; 'ml_model' = modelo treinado"
    )
    name: str
    sample_size: int = Field(description="Entregas históricas que sustentam a estimativa")
    uses_package_features: bool = Field(
        description="Se peso, valor e dimensões influenciam o resultado"
    )


class SimulationResult(BaseModel):
    delay_probability: float = Field(description="Probabilidade estimada de atraso (0-100)")
    risk_level: Literal["low", "moderate", "high"]
    estimated_days: int = Field(description="Prazo informado, em dias")
    typical_days: float = Field(description="Mediana de dias de entrega em rotas de distância parecida")
    distance_km: float = Field(description="Distância em linha reta entre origem e destino")
    origin: SimulationLocation
    destination: SimulationLocation
    factors: list[RiskFactor]
    model: ModelInfo