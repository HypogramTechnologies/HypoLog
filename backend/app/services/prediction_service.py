import pandas as pd

from app.core.exceptions import InvalidInputError
from app.ml.features import INPUT_COLUMNS
from app.repositories.city_repository import CityRepository
from app.schemas.predictions import (
    DestinationInfo,
    LocationInfo,
    PredictionRequest,
    PredictionResponse,
    RiskThresholds,
)
from app.utils.text import to_display_name


class PredictionService:
    def __init__(self, artifact: dict, city_repository: CityRepository):
        self._model = artifact["model"]
        self._builder = artifact["feature_builder"]
        self._columns = artifact["feature_columns"]
        self._bands = artifact["risk_bands"]
        self._cities = city_repository

    def predict(self, request: PredictionRequest) -> PredictionResponse:
        shipment = self._to_input(request)

        try:
            features = self._builder.transform(shipment)
        except ValueError as exc:  # CEP impossível de localizar
            raise InvalidInputError(str(exc)) from exc

        probability = float(self._model.predict_proba(features[self._columns])[0, 1])

        return PredictionResponse(
            delay_probability=round(probability * 100, 2),
            risk_level=self._risk_level(probability),
            likely_delayed=probability >= self._bands["high"],
            distance_km=round(float(features["distance_km"].iloc[0]), 1),
            origin=self._origin_info(request.origin_prefix),
            destination=self._destination_info(request.destination_prefix),
            thresholds=RiskThresholds(
                medium=round(self._bands["medium"] * 100, 2),
                high=round(self._bands["high"] * 100, 2),
            ),
        )

    # ------------------------------------------------------------ auxiliares
    @staticmethod
    def _to_input(request: PredictionRequest) -> pd.DataFrame:
        """Converte a requisição no formato que o FeatureBuilder espera (INPUT_COLUMNS)."""
        row = {
            "origin_zip": request.origin_prefix,
            "destination_zip": request.destination_prefix,
            "purchase_date": pd.Timestamp(request.purchase_date or pd.Timestamp.today().date()),
            "promised_days": request.promised_days,
            "weight_g": request.weight_g,
            "volume_cm3": request.length_cm * request.height_cm * request.width_cm,
            "n_items": request.n_items,
        }
        return pd.DataFrame([row], columns=INPUT_COLUMNS)

    def _risk_level(self, probability: float) -> str:
        if probability >= self._bands["high"]:
            return "alto"
        if probability >= self._bands["medium"]:
            return "medio"
        return "baixo"

    def _city_name(self, city_key: str, state: str) -> str:
        city = self._cities.get_by_key(city_key, state)
        return city["city_name"] if city else to_display_name(city_key)

    def _origin_info(self, zip_prefix: int) -> LocationInfo:
        used, exact = self._builder.resolve_zip(zip_prefix)
        geo = self._builder.zip_table.loc[used]
        return LocationInfo(
            zip_prefix_used=f"{used:05d}",
            exact_match=exact,
            city_name=self._city_name(geo["city_key"], geo["state"]),
            state_code=geo["state"],
        )

    def _destination_info(self, zip_prefix: int) -> DestinationInfo:
        info = self._builder.describe_destination(zip_prefix)
        return DestinationInfo(
            zip_prefix_used=f"{info['zip_used']:05d}",
            exact_match=info["exact_match"],
            city_name=self._city_name(info["city_key"], info["state"]),
            state_code=info["state"],
            zone=info["zone"],
            zone_delay_rate=round(info["zone_delay_rate"] * 100, 2),
        )
