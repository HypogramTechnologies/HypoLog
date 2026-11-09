from app.schemas.simulations import (
    ModelInfo,
    RiskFactor,
    SimulationLocation,
    SimulationRequest,
    SimulationResult,
)
from app.services.risk_baseline import PackageFeatures, RiskPrediction, RiskPredictor
from app.services.zip_locator import ZipLocator

# Limites dos níveis de risco, em %. Usados pelo baseline; o modelo de ML traz os
# seus próprios limites (`risk_bands`), calibrados na taxa real de atraso da base.
MODERATE_FROM = 20.0
HIGH_FROM = 50.0

# Quão distante da referência um fator precisa estar para contar como "eleva/reduz"
DEADLINE_MARGIN = 0.15
HISTORY_MARGIN = 0.25


def _format_zip(digits: str) -> str:
    return f"{digits[:5]}-{digits[5:]}"


def _fmt_int(value: float) -> str:
    return f"{value:,.0f}".replace(",", ".")


def _days(n: float) -> str:
    """'1 dia' / '5 dias' (concordância correta)."""
    n = int(round(n))
    return f"{n} dia" if n == 1 else f"{n} dias"


def _fmt_pct(value: float) -> str:
    return f"{value * 100:.1f}".replace(".", ",") + "%"


class SimulationService:
    def __init__(self, locator: ZipLocator, predictor: RiskPredictor):
        self._locator = locator
        self._predictor = predictor

    def simulate(self, request: SimulationRequest) -> SimulationResult:
        origin = self._locator.locate(request.origin_prefix)
        destination = self._locator.locate(request.destination_prefix)

        package = PackageFeatures(
            weight_kg=request.weight_kg,
            order_value=request.order_value,
            height_cm=request.height_cm,
            width_cm=request.width_cm,
            length_cm=request.length_cm,
            n_items=request.n_items,
        )
        prediction = self._predictor.predict(
            origin, destination, request.estimated_days, package, request.purchase_date
        )
        probability = round(prediction.probability * 100, 1)
        dest_zone = self._zone_info(destination)

        return SimulationResult(
            delay_probability=probability,
            risk_level=self._risk_level(probability),
            estimated_days=request.estimated_days,
            typical_days=round(prediction.typical_days, 1),
            distance_km=round(prediction.distance_km),
            origin=self._location(origin, request.origin_zip),
            destination=self._location(destination, request.destination_zip),
            factors=self._factors(destination, request.estimated_days, prediction, dest_zone),
            model=ModelInfo(
                kind=self._predictor.kind,
                name=self._predictor.name,
                sample_size=prediction.sample_size,
                uses_package_features=getattr(self._predictor, "uses_package_features", False),
            ),
        )

    # ------------------------------------------------------------ auxiliares
    def _risk_level(self, probability: float) -> str:
        # Limites do modelo (em fração) quando existem; senão os do baseline (em %)
        bands = getattr(self._predictor, "risk_bands", None)
        high, moderate = (
            (bands["high"] * 100, bands["medium"] * 100) if bands else (HIGH_FROM, MODERATE_FROM)
        )
        if probability >= high:
            return "high"
        return "moderate" if probability >= moderate else "low"

    def _zone_info(self, located: dict) -> dict | None:
        """Zona do CEP, se o estimador souber calculá-la (só o modelo de ML sabe)."""
        describe = getattr(self._predictor, "describe_zone", None)
        return describe(located["zip_prefix"]) if describe else None

    def _location(self, located: dict, zip_digits: str) -> SimulationLocation:
        zone = self._zone_info(located)
        return SimulationLocation(
            zip_code=_format_zip(zip_digits),
            city_name=located["city_name"],
            state_code=located["state_code"],
            zone=zone["label"] if zone else None,
            approximated=located["approximated"],
        )

    @staticmethod
    def _place(located: dict) -> str:
        return f"{located['city_name']}/{located['state_code']}"

    def _factors(
        self, destination: dict, estimated_days: int, p: RiskPrediction, zone: dict | None
    ) -> list[RiskFactor]:
        factors = [self._distance_factor(p)]
        factors.append(self._deadline_factor(estimated_days, p))
        if p.destination_rate is not None:
            factors.append(self._history_factor(destination, p))
        if zone and zone["n_zones"] > 1:
            factors.append(self._zone_factor(destination, zone, p))
        return factors

    @staticmethod
    def _zone_factor(destination: dict, zone: dict, p: RiskPrediction) -> RiskFactor:
        ratio = zone["delay_rate"] / p.national_rate if p.national_rate else 1.0
        impact = "raises" if ratio > 1 + HISTORY_MARGIN else "lowers" if ratio < 1 - HISTORY_MARGIN else "neutral"
        return RiskFactor(
            code="destination_zone",
            impact=impact,
            label=(
                f"{zone['label']} em {destination['city_name']} teve {_fmt_pct(zone['delay_rate'])} "
                f"de atrasos no histórico (Brasil: {_fmt_pct(p.national_rate)})."
            ),
        )

    @staticmethod
    def _distance_factor(p: RiskPrediction) -> RiskFactor:
        ratio = p.typical_days / p.national_typical_days
        if ratio > 1 + HISTORY_MARGIN:
            impact, versus = "raises", "acima"
        elif ratio < 1 - HISTORY_MARGIN:
            impact, versus = "lowers", "abaixo"
        else:
            impact, versus = "neutral", "próximo"
        return RiskFactor(
            code="distance",
            impact=impact,
            label=(
                f"Rota de ~{_fmt_int(p.distance_km)} km: entregas nessa distância levam {_days(p.typical_days)} "
                f"em mediana, {versus} da média do país ({_days(p.national_typical_days)})."
            ),
        )

    @staticmethod
    def _deadline_factor(estimated_days: int, p: RiskPrediction) -> RiskFactor:
        gap = round(abs(p.typical_days - estimated_days))
        if estimated_days < p.typical_days * (1 - DEADLINE_MARGIN):
            impact, text = "raises", f"Prazo de {_days(estimated_days)} é {_days(gap)} menor que o tempo típico ({_days(p.typical_days)})."
        elif estimated_days > p.typical_days * (1 + DEADLINE_MARGIN):
            impact, text = "lowers", f"Prazo de {_days(estimated_days)} dá {_days(gap)} de folga sobre o tempo típico ({_days(p.typical_days)})."
        else:
            impact, text = "neutral", f"Prazo de {_days(estimated_days)} está próximo do tempo típico ({_days(p.typical_days)})."
        return RiskFactor(code="deadline", impact=impact, label=text)

    def _history_factor(self, destination: dict, p: RiskPrediction) -> RiskFactor:
        ratio = p.destination_rate / p.national_rate if p.national_rate else 1.0
        impact = "raises" if ratio > 1 + HISTORY_MARGIN else "lowers" if ratio < 1 - HISTORY_MARGIN else "neutral"
        return RiskFactor(
            code="destination_history",
            impact=impact,
            label=(
                f"Pedidos para {destination['state_code']} tiveram {_fmt_pct(p.destination_rate)} de atrasos "
                f"no histórico (Brasil: {_fmt_pct(p.national_rate)})."
            ),
        )