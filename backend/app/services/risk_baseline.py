from dataclasses import dataclass
from datetime import date
from typing import Protocol

import numpy as np
import pandas as pd

EARTH_RADIUS_KM = 6371.0088

# Janela de "rotas parecidas": ±15% da distância (mínimo ±40 km), ampliada até
# reunir amostra suficiente para a frequência ser confiável.
WINDOW_RATIO = 0.15
WINDOW_MIN_KM = 40.0
MIN_SAMPLES = 300


@dataclass(frozen=True)
class PackageFeatures:
    """Características do pacote informadas no simulador."""

    weight_kg: float
    order_value: float
    height_cm: float
    width_cm: float
    length_cm: float
    n_items: int = 1

    @property
    def volume_cm3(self) -> float:
        return self.height_cm * self.width_cm * self.length_cm


@dataclass(frozen=True)
class RiskPrediction:
    probability: float  # 0-1
    distance_km: float
    typical_days: float  # mediana de dias entre compra e entrega em rotas parecidas
    sample_size: int  # entregas históricas usadas no cálculo
    destination_rate: float | None  # taxa histórica de atraso da UF de destino (0-1)
    national_rate: float  # taxa histórica de atraso do Brasil (0-1)
    national_typical_days: float  # mediana de dias de entrega no Brasil todo


class RiskPredictor(Protocol):
    """Contrato que o modelo de ML precisa cumprir para substituir o baseline.

    Basta uma classe com `kind`, `name` e `predict(...)`; o service, a rota e a
    tela não mudam.
    """

    kind: str
    name: str

    def predict(
        self,
        origin: dict,
        destination: dict,
        estimated_days: int,
        package: PackageFeatures | None = None,
        purchase_date: date | None = None,
    ) -> RiskPrediction: ...


def haversine_km(lat1, lng1, lat2, lng2):
    """Distância em linha reta (km). Aceita escalares ou arrays do numpy."""
    lat1, lng1, lat2, lng2 = map(np.radians, (lat1, lng1, lat2, lng2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lng2 - lng1) / 2) ** 2
    return 2 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(a))


class HistoricalBaseline:
    """Baseline sem ML: P(entrega demorar mais que o prazo | rotas de distância parecida).

    Olhamos o histórico da Olist, pegamos as entregas cuja distância
    vendedor→cliente é parecida com a da rota simulada e medimos que fração delas
    levou mais dias do que o prazo informado. É interpretável e já usa dados reais.

    Limitação conhecida: a base processada ainda não traz peso, dimensões nem
    valor, então esses campos não influenciam a estimativa.
    """

    kind = "historical_baseline"
    name = "Baseline histórico (distância e prazo)"

    def __init__(self, deliveries: pd.DataFrame):
        rows = deliveries.dropna(subset=["customer_lat", "customer_lng", "seller_lat", "seller_lng"])
        distance = haversine_km(
            rows["seller_lat"].to_numpy(), rows["seller_lng"].to_numpy(),
            rows["customer_lat"].to_numpy(), rows["customer_lng"].to_numpy(),
        )
        order = np.argsort(distance)
        # Ordenado por distância: a janela de rotas parecidas vira um fatiamento
        self._distance = distance[order]
        self._days = rows["delivery_days"].to_numpy()[order]

        orders = deliveries.drop_duplicates("order_id")
        self._national_rate = float(orders["is_delayed"].mean())
        self._national_typical_days = float(np.median(self._days))
        self._state_rate = orders.groupby("customer_state")["is_delayed"].mean().to_dict()

    def predict(
        self,
        origin: dict,
        destination: dict,
        estimated_days: int,
        package: PackageFeatures | None = None,  # ignorados: o baseline só usa distância e prazo
        purchase_date: date | None = None,
    ) -> RiskPrediction:
        distance_km = float(
            haversine_km(origin["lat"], origin["lng"], destination["lat"], destination["lng"])
        )
        days = self._similar_routes(distance_km)

        # Suavização de Laplace: evita 0% e 100% absolutos
        late = int((days > estimated_days).sum())
        probability = (late + 0.5) / (len(days) + 1)

        return RiskPrediction(
            probability=probability,
            distance_km=distance_km,
            typical_days=float(np.median(days)),
            sample_size=len(days),
            destination_rate=self._state_rate.get(destination["state_code"]),
            national_rate=self._national_rate,
            national_typical_days=self._national_typical_days,
        )

    def _similar_routes(self, distance_km: float) -> np.ndarray:
        half = max(distance_km * WINDOW_RATIO, WINDOW_MIN_KM)
        while True:
            lo = np.searchsorted(self._distance, distance_km - half, side="left")
            hi = np.searchsorted(self._distance, distance_km + half, side="right")
            if hi - lo >= MIN_SAMPLES or (lo == 0 and hi == len(self._distance)):
                return self._days[lo:hi]
            half *= 1.25