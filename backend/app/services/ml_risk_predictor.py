"""Adaptador: coloca o modelo treinado do HypoLog (Gradient Boosting) no contrato `RiskPredictor`.

O artefato (`models/delay_model.joblib`) é gerado por `python -m scripts.train_model`
e traz o modelo, o FeatureBuilder (zonas de CEP e históricos de atraso) e as faixas
de risco. Este adaptador só traduz o formato do simulador para o do modelo; os campos
de apoio da tela (mediana de dias, taxas do país) continuam vindo do baseline.
"""
from datetime import date

import pandas as pd

from app.ml.features import INPUT_COLUMNS
from app.services.risk_baseline import (
    HistoricalBaseline,
    PackageFeatures,
    RiskPrediction,
)


class MLRiskPredictor:
    kind = "ml_model"
    name = "Gradient Boosting (prazo, distância, peso, volume, zona e histórico)"
    uses_package_features = True

    def __init__(self, artifact: dict, baseline: HistoricalBaseline):
        self._model = artifact["model"]
        self._builder = artifact["feature_builder"]
        self._columns = artifact["feature_columns"]
        self._training_size = int(artifact["report"]["sizes"]["final_model"])
        # Faixas de risco do modelo, em fração: {"medium": 0.044, "high": 0.088}
        self.risk_bands: dict = artifact["risk_bands"]
        self._baseline = baseline

    def predict(
        self,
        origin: dict,
        destination: dict,
        estimated_days: int,
        package: PackageFeatures | None = None,
        purchase_date: date | None = None,
    ) -> RiskPrediction:
        if package is None:
            raise ValueError("O modelo de ML precisa dos dados do pacote (peso, dimensões, itens)")

        shipment = pd.DataFrame(
            [{
                "origin_zip": origin["zip_prefix"],
                "destination_zip": destination["zip_prefix"],
                "purchase_date": pd.Timestamp(purchase_date or pd.Timestamp.today().date()),
                "promised_days": estimated_days,
                "weight_g": package.weight_kg * 1000,
                "volume_cm3": package.volume_cm3,
                "n_items": package.n_items,
            }],
            columns=INPUT_COLUMNS,
        )
        features = self._builder.transform(shipment)
        probability = float(self._model.predict_proba(features[self._columns])[0, 1])

        base = self._baseline.predict(origin, destination, estimated_days)
        return RiskPrediction(
            probability=probability,
            distance_km=base.distance_km,
            typical_days=base.typical_days,
            sample_size=self._training_size,
            destination_rate=base.destination_rate,
            national_rate=base.national_rate,
            national_typical_days=base.national_typical_days,
        )

    def describe_zone(self, zip_prefix: int) -> dict:
        """Zona do CEP (faixa dentro da cidade) e a taxa histórica de atraso dela."""
        info = self._builder.describe_destination(zip_prefix)
        n = info["n_zones"]
        return {
            "zone": info["zone"],
            "n_zones": n,
            "label": f"Zona {info['zone']} de {n}" if n > 1 else "Zona única",
            "delay_rate": info["zone_delay_rate"],
        }