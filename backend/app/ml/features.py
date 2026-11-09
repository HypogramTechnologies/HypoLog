"""Cálculo das features do modelo de atraso.

O MESMO código é usado no treino (scripts/train_model.py) e na API (rota de predição),
para garantir que o modelo receba os dados sempre no mesmo formato.

Entrada: um DataFrame com uma linha por envio e as colunas de INPUT_COLUMNS.
Saída:   um DataFrame numérico com as colunas de `feature_columns`.
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import KFold

from app.utils.states import BRAZIL_STATES

# O que todo envio precisa informar (no treino vem da Olist; na API, do simulador)
INPUT_COLUMNS = [
    "origin_zip",       # prefixo de 5 dígitos do CEP do vendedor
    "destination_zip",  # prefixo de 5 dígitos do CEP do cliente
    "purchase_date",    # data da compra
    "promised_days",    # prazo prometido, em dias
    "weight_g",         # peso total dos itens do envio
    "volume_cm3",       # volume total dos itens do envio
    "n_items",          # quantidade de itens
]

# Zonas de CEP por cidade: quanto maior a cidade, mais zonas.
# Cada zona precisa de pedidos suficientes para a taxa de atraso ser confiável.
MIN_ORDERS_PER_ZONE = 300    # pedidos mínimos (no treino) em cada zona
MIN_PREFIXES_PER_ZONE = 2    # prefixos de CEP mínimos em cada zona
MAX_ZONES = 8
SMOOTHING = 20  # quantos pedidos "fictícios" com a taxa global somamos a cada grupo
STATES = sorted(BRAZIL_STATES)


def haversine_km(lat1, lng1, lat2, lng2) -> np.ndarray:
    """Distância em linha reta entre dois pontos da Terra, em km."""
    lat1, lng1, lat2, lng2 = map(np.radians, (lat1, lng1, lat2, lng2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lng2 - lng1) / 2) ** 2
    return 6371 * 2 * np.arcsin(np.sqrt(a))


def zones_for_city(orders: int, prefixes: int) -> int:
    """Nº de zonas de uma cidade: 1 para cidades pequenas, até MAX_ZONES para as grandes."""
    n = min(orders // MIN_ORDERS_PER_ZONE, prefixes // MIN_PREFIXES_PER_ZONE)
    return int(np.clip(n, 1, MAX_ZONES))


ZONE_KEYS = ["dest_city", "dest_state", "destination_zone"]
ORIGIN_KEYS = ["origin_city", "origin_state"]
MAX_DAYS_FOR_STATS = 60  # entregas muito longas (outliers) são limitadas nas médias de dias


class FeatureBuilder:
    """Aprende, com os dados de treino, as zonas de CEP e os históricos de atraso e de
    tempo de entrega, e transforma envios em features numéricas para o modelo.

    No treino, o DataFrame de `fit`/`fit_transform` precisa ter também a coluna
    `delivery_days` (dias reais até a entrega). Na predição (`transform`) ela não é usada."""

    def __init__(self, zip_table: pd.DataFrame):
        """zip_table: índice = prefixo de CEP; colunas lat, lng, city_key, state.
        É informação geográfica fixa (não tem nada sobre atrasos)."""
        self.zip_table = zip_table
        self.zone_bounds: dict[tuple[str, str], np.ndarray] = {}
        self.zone_rates: pd.Series | None = None
        self.origin_rates: pd.Series | None = None
        self.zone_days: pd.Series | None = None
        self.origin_days: pd.Series | None = None
        self.global_rate: float | None = None
        self.global_days: float | None = None

    # ================================================================ aprender
    def fit(self, df: pd.DataFrame, y: pd.Series) -> "FeatureBuilder":
        base = self._add_geography(df)
        self._fit_zones(base)
        base["destination_zone"] = self._assign_zones(base)
        days = self._days(df)
        self.global_rate = float(y.mean())
        self.global_days = float(days.mean())
        self.zone_rates = self._smoothed_rates(base, y, ZONE_KEYS)
        self.origin_rates = self._smoothed_rates(base, y, ORIGIN_KEYS)
        self.zone_days = self._smoothed_rates(base, days, ZONE_KEYS, self.global_days)
        self.origin_days = self._smoothed_rates(base, days, ORIGIN_KEYS, self.global_days)
        return self

    def fit_transform(self, df: pd.DataFrame, y: pd.Series, n_splits: int = 5) -> pd.DataFrame:
        """Usado SÓ no treino. Os históricos de cada linha são calculados sem ela mesma
        (validação cruzada), senão o modelo "vê" a resposta dentro da própria feature."""
        self.fit(df, y)
        features = self.transform(df)

        base = self._add_geography(df)
        base["destination_zone"] = self._assign_zones(base)
        days = self._days(df)

        for train_idx, fold_idx in KFold(n_splits, shuffle=True, random_state=42).split(base):
            part, fold = base.iloc[train_idx], base.iloc[fold_idx]
            part_y, part_days = y.iloc[train_idx], days.iloc[train_idx]
            g_rate, g_days = float(part_y.mean()), float(part_days.mean())
            encodings = {
                "zone_delay_rate": (self._smoothed_rates(part, part_y, ZONE_KEYS, g_rate), ZONE_KEYS, g_rate),
                "origin_delay_rate": (self._smoothed_rates(part, part_y, ORIGIN_KEYS, g_rate), ORIGIN_KEYS, g_rate),
                "zone_days": (self._smoothed_rates(part, part_days, ZONE_KEYS, g_days), ZONE_KEYS, g_days),
                "origin_days": (self._smoothed_rates(part, part_days, ORIGIN_KEYS, g_days), ORIGIN_KEYS, g_days),
            }
            for column, (table, keys, default) in encodings.items():
                features.iloc[fold_idx, features.columns.get_loc(column)] = self._lookup(fold, table, keys, default)
        return features

    @staticmethod
    def _days(df: pd.DataFrame) -> pd.Series:
        return df["delivery_days"].astype(float).clip(upper=MAX_DAYS_FOR_STATS)

    # ============================================================== transformar
    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        if self.global_rate is None:
            raise RuntimeError("FeatureBuilder ainda não foi treinado (chame fit)")

        base = self._add_geography(df)
        base["destination_zone"] = self._assign_zones(base)
        purchase = pd.to_datetime(base["purchase_date"])

        features = pd.DataFrame(index=df.index)
        features["distance_km"] = haversine_km(base["origin_lat"], base["origin_lng"],
                                               base["dest_lat"], base["dest_lng"])
        features["same_city"] = ((base["origin_city"] == base["dest_city"])
                                 & (base["origin_state"] == base["dest_state"])).astype(int)
        features["same_state"] = (base["origin_state"] == base["dest_state"]).astype(int)
        features["promised_days"] = base["promised_days"].astype(float)
        features["weight_g"] = base["weight_g"].astype(float)
        features["volume_cm3"] = base["volume_cm3"].astype(float)
        features["n_items"] = base["n_items"].astype(float)
        features["purchase_month"] = purchase.dt.month
        features["purchase_weekday"] = purchase.dt.weekday
        features["zone_delay_rate"] = self._lookup(base, self.zone_rates, ZONE_KEYS, self.global_rate)
        features["origin_delay_rate"] = self._lookup(base, self.origin_rates, ORIGIN_KEYS, self.global_rate)
        features["zone_days"] = self._lookup(base, self.zone_days, ZONE_KEYS, self.global_days)
        features["origin_days"] = self._lookup(base, self.origin_days, ORIGIN_KEYS, self.global_days)

        # UF como colunas 0/1 (uma por estado), sempre na mesma ordem
        for side, col in (("origin", "origin_state"), ("dest", "dest_state")):
            for uf in STATES:
                features[f"{side}_uf_{uf}"] = (base[col] == uf).astype(int)

        return features

    @property
    def feature_columns(self) -> list[str]:
        base = ["distance_km", "same_city", "same_state", "promised_days", "weight_g",
                "volume_cm3", "n_items", "purchase_month", "purchase_weekday",
                "zone_delay_rate", "origin_delay_rate", "zone_days", "origin_days"]
        return base + [f"{s}_uf_{uf}" for s in ("origin", "dest") for uf in STATES]

    def resolve_zip(self, zip_prefix: int) -> tuple[int, bool]:
        """Prefixo de CEP que será usado na previsão e se ele é exato.

        Se o prefixo não existe na base, usa o prefixo conhecido mais próximo que
        compartilhe o máximo de dígitos iniciais (4, depois 3, 2 e 1). Como os CEPs
        são hierárquicos, isso costuma ser um endereço vizinho.
        """
        zip_prefix = int(zip_prefix)
        if zip_prefix in self.zip_table.index:
            return zip_prefix, True

        known = np.sort(self.zip_table.index.to_numpy(dtype=int))
        for shared_digits in (4, 3, 2, 1):
            block = 10 ** (5 - shared_digits)
            low = zip_prefix // block * block
            start, end = np.searchsorted(known, [low, low + block])
            candidates = known[start:end]
            if len(candidates):
                return int(candidates[np.argmin(np.abs(candidates - zip_prefix))]), False

        raise ValueError(f"CEP {zip_prefix:05d} inválido")

    def describe_destination(self, destination_zip: int) -> dict:
        """Zona e histórico do CEP de destino (para mostrar na resposta da API)."""
        used_zip, exact = self.resolve_zip(destination_zip)
        row = self._add_geography(pd.DataFrame({"origin_zip": [used_zip],
                                                "destination_zip": [used_zip]}))
        zone = int(self._assign_zones(row).iloc[0])
        key = (row["dest_city"].iloc[0], row["dest_state"].iloc[0], zone)
        bounds = self.zone_bounds.get((key[0], key[1]))
        return {
            "n_zones": 1 if bounds is None else len(bounds) + 1,
            "zip_used": used_zip,
            "exact_match": exact,
            "city_key": key[0],
            "state": key[1],
            "zone": zone,
            "zone_delay_rate": float(self.zone_rates.get(key, self.global_rate)),
        }

    # ================================================================ internos
    def _add_geography(self, df: pd.DataFrame) -> pd.DataFrame:
        """Junta coordenadas, cidade e UF da origem e do destino."""
        base = df.copy()
        for side, col in (("origin", "origin_zip"), ("dest", "destination_zip")):
            # CEPs fora da base usam o vizinho mais próximo (ver resolve_zip)
            zips = base[col].astype(int)
            unknown = ~zips.isin(self.zip_table.index)
            if unknown.any():
                zips = zips.copy()
                zips[unknown] = [self.resolve_zip(z)[0] for z in zips[unknown]]
                base[col] = zips
            geo = self.zip_table.reindex(zips.to_numpy())
            base[f"{side}_lat"] = geo["lat"].to_numpy()
            base[f"{side}_lng"] = geo["lng"].to_numpy()
            base[f"{side}_city"] = geo["city_key"].to_numpy()
            base[f"{side}_state"] = geo["state"].to_numpy()
        return base

    def _fit_zones(self, base: pd.DataFrame) -> None:
        """Por cidade, ordena os prefixos e corta em faixas com quantidades de pedidos
        parecidas. O nº de faixas depende do tamanho da cidade (zones_for_city).
        Guarda o maior prefixo de cada faixa."""
        counts = base.groupby(["dest_city", "dest_state", "destination_zip"]).size().rename("orders")
        self.zone_bounds = {}
        for (city, state), group in counts.groupby(level=[0, 1]):
            group = group.droplevel([0, 1]).sort_index()
            before = group.cumsum() - group
            n_zones = zones_for_city(int(group.sum()), len(group))
            zone = (before / group.sum() * n_zones).astype(int)
            upper = group.groupby(zone.to_numpy()).apply(lambda s: s.index.max())
            self.zone_bounds[(city, state)] = upper.to_numpy()[:-1]  # o último limite é aberto

    def _assign_zones(self, base: pd.DataFrame) -> pd.Series:
        """Zona 1..N de cada destino (N varia por cidade). CEPs fora dos limites conhecidos caem na faixa mais próxima;
        cidades sem pedidos no treino ficam com zona 1."""
        zones = np.ones(len(base), dtype=int)
        keys = list(zip(base["dest_city"], base["dest_state"]))
        zips = base["destination_zip"].astype(int).to_numpy()
        for i, key in enumerate(keys):
            bounds = self.zone_bounds.get(key)
            if bounds is not None and len(bounds):
                zones[i] = int(np.searchsorted(bounds, zips[i], side="left")) + 1
        return pd.Series(zones, index=base.index)

    def _smoothed_rates(self, base, y, keys, global_rate=None) -> pd.Series:
        """Taxa de atraso por grupo, "puxada" para a taxa global quando o grupo é pequeno:
        (atrasados + SMOOTHING * global) / (pedidos + SMOOTHING)."""
        global_rate = self.global_rate if global_rate is None else global_rate
        stats = base[keys].assign(y=y.to_numpy()).groupby(keys)["y"].agg(["sum", "count"])
        return (stats["sum"] + SMOOTHING * global_rate) / (stats["count"] + SMOOTHING)

    @staticmethod
    def _lookup(base, rates, keys, default) -> np.ndarray:
        index = pd.MultiIndex.from_frame(base[keys]) if len(keys) > 1 else base[keys[0]]
        return rates.reindex(index).fillna(default).to_numpy()


def build_zip_table(geolocation: pd.DataFrame) -> pd.DataFrame:
    """Uma linha por prefixo de CEP: coordenada mediana e a cidade/UF mais frequente.
    `geolocation` é o CSV olist_geolocation_dataset."""
    from app.utils.text import normalize_city

    geo = geolocation[
        geolocation["geolocation_lat"].between(-34.0, 5.5)
        & geolocation["geolocation_lng"].between(-74.0, -34.0)
    ].copy()
    geo["city_key"] = geo["geolocation_city"].map(normalize_city)
    geo["state"] = geo["geolocation_state"].str.upper().str.strip()

    coords = geo.groupby("geolocation_zip_code_prefix")[["geolocation_lat", "geolocation_lng"]].median()
    city = (
        geo.groupby(["geolocation_zip_code_prefix", "city_key", "state"]).size()
        .rename("n").reset_index()
        .sort_values("n", ascending=False)
        .drop_duplicates("geolocation_zip_code_prefix")
        .set_index("geolocation_zip_code_prefix")[["city_key", "state"]]
    )
    table = coords.join(city).rename(columns={"geolocation_lat": "lat", "geolocation_lng": "lng"})
    table.index.name = "zip_prefix"
    return table