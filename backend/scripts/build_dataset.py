"""Junta e limpa os CSVs da Olist e gera os arquivos usados pela API.

Saídas (em data/processed/):
- deliveries.parquet : uma linha por (pedido, vendedor). Um pedido com itens de
                       2 vendedores gera 2 linhas, pois são 2 rotas diferentes.
- cities.parquet     : uma linha por cidade (origem ou destino), com id e nome de exibição.

Uso (dentro de backend/):  python -m scripts.build_dataset
"""

from pathlib import Path

import pandas as pd

from app.utils.states import BRAZIL_STATES
from app.utils.text import clean_city, has_accent, normalize_city, to_display_name

BASE_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DIR = BASE_DIR / "data" / "processed"

# Limites aproximados do Brasil, para descartar coordenadas erradas da base
LAT_RANGE = (-34.0, 5.5)
LNG_RANGE = (-74.0, -34.0)


# ---------------------------------------------------------------- leitura
def load_raw() -> dict[str, pd.DataFrame]:
    date_cols = [
        "order_purchase_timestamp",
        "order_delivered_customer_date",
        "order_estimated_delivery_date",
    ]
    return {
        "orders": pd.read_csv(RAW_DIR / "olist_orders_dataset.csv", parse_dates=date_cols),
        "items": pd.read_csv(RAW_DIR / "olist_order_items_dataset.csv", usecols=["order_id", "seller_id"]),
        "customers": pd.read_csv(RAW_DIR / "olist_customers_dataset.csv"),
        "sellers": pd.read_csv(RAW_DIR / "olist_sellers_dataset.csv"),
        "geolocation": pd.read_csv(RAW_DIR / "olist_geolocation_dataset.csv"),
    }


# ---------------------------------------------------------------- coordenadas
def build_zip_coordinates(geo: pd.DataFrame) -> pd.DataFrame:
    """Uma coordenada (mediana) por prefixo de CEP."""
    geo = geo[
        geo["geolocation_lat"].between(*LAT_RANGE) & geo["geolocation_lng"].between(*LNG_RANGE)
    ]
    return (
        geo.groupby("geolocation_zip_code_prefix")[["geolocation_lat", "geolocation_lng"]]
        .median()
        .rename(columns={"geolocation_lat": "lat", "geolocation_lng": "lng"})
    )


# ---------------------------------------------------------------- entregas
def build_deliveries(raw: dict[str, pd.DataFrame]) -> pd.DataFrame:
    orders = raw["orders"]
    coords = build_zip_coordinates(raw["geolocation"])

    # 1. Só pedidos entregues e com data de entrega
    orders = orders[
        (orders["order_status"] == "delivered") & orders["order_delivered_customer_date"].notna()
    ]

    # 2. Pedido -> vendedor(es): remove itens repetidos do mesmo vendedor no pedido
    order_sellers = raw["items"].drop_duplicates()

    df = (
        orders.merge(order_sellers, on="order_id")
        .merge(raw["customers"], on="customer_id")
        .merge(raw["sellers"], on="seller_id")
    )

    # 3. Coordenadas do cliente (destino) e do vendedor (origem)
    df = df.join(coords, on="customer_zip_code_prefix").rename(
        columns={"lat": "customer_lat", "lng": "customer_lng"}
    )
    df = df.join(coords, on="seller_zip_code_prefix").rename(
        columns={"lat": "seller_lat", "lng": "seller_lng"}
    )

    # 4. Métricas de entrega
    purchase = df["order_purchase_timestamp"]
    delivered = df["order_delivered_customer_date"]
    estimated = df["order_estimated_delivery_date"]

    df["delivery_days"] = (delivered - purchase).dt.total_seconds() / 86400
    df["delay_days"] = (delivered.dt.normalize() - estimated.dt.normalize()).dt.days
    df["is_delayed"] = df["delay_days"] > 0  # entregue depois do DIA estimado

    # 5. Padroniza cidades e UFs (chave de comparação)
    for col in ("customer_city", "seller_city"):
        df[col] = df[col].map(normalize_city)
    for col in ("customer_state", "seller_state"):
        df[col] = df[col].str.upper().str.strip()

    return df.rename(
        columns={
            "order_purchase_timestamp": "purchase_date",
            "order_delivered_customer_date": "delivered_date",
            "order_estimated_delivery_date": "estimated_date",
            "customer_zip_code_prefix": "customer_zip_prefix",
            "seller_zip_code_prefix": "seller_zip_prefix",
        }
    )


# ---------------------------------------------------------------- cidades
def build_display_names(geo: pd.DataFrame) -> pd.DataFrame:
    """Escolhe a melhor grafia de cada (cidade, UF) no geolocation:
    a mais frequente COM acento; se não houver, a mais frequente sem acento."""
    names = geo[["geolocation_city", "geolocation_state"]].dropna().copy()
    names["city"] = names["geolocation_city"].map(normalize_city)
    names["state"] = names["geolocation_state"].str.upper().str.strip()
    names["raw"] = names["geolocation_city"].map(clean_city)
    names["accent"] = names["raw"].map(has_accent)

    counts = names.groupby(["city", "state", "raw", "accent"], as_index=False).size()
    best = (
        counts.sort_values(["accent", "size"], ascending=False)
        .drop_duplicates(["city", "state"])
    )
    best["city_name"] = best["raw"].map(to_display_name)
    return best[["city", "state", "city_name"]]


def build_cities(deliveries: pd.DataFrame, geo: pd.DataFrame) -> pd.DataFrame:
    destinations = deliveries[["customer_city", "customer_state"]].drop_duplicates()
    destinations.columns = ["city", "state"]
    destinations["is_destination"] = True

    origins = deliveries[["seller_city", "seller_state"]].drop_duplicates()
    origins.columns = ["city", "state"]
    origins["is_origin"] = True

    cities = destinations.merge(origins, on=["city", "state"], how="outer")
    cities[["is_destination", "is_origin"]] = (
        cities[["is_destination", "is_origin"]].astype("boolean").fillna(False).astype(bool)
    )
    cities = cities[cities["state"].isin(BRAZIL_STATES.keys())]

    # Nome de exibição: grafia do geolocation ou, se não existir, a própria chave formatada
    cities = cities.merge(build_display_names(geo), on=["city", "state"], how="left")
    cities["city_name"] = cities["city_name"].fillna(cities["city"].map(to_display_name))

    # Estado
    cities["state_id"] = cities["state"].map(lambda uf: BRAZIL_STATES[uf][0])
    cities["state_name"] = cities["state"].map(lambda uf: BRAZIL_STATES[uf][1])

    # Id estável: ordena por UF e cidade e numera a partir de 1
    cities = cities.sort_values(["state", "city"]).reset_index(drop=True)
    cities["city_id"] = cities.index + 1

    return cities.rename(columns={"city": "city_key", "state": "state_code"})[
        ["city_id", "city_key", "city_name", "state_id", "state_code", "state_name",
         "is_destination", "is_origin"]
    ]


def attach_city_ids(deliveries: pd.DataFrame, cities: pd.DataFrame) -> pd.DataFrame:
    ids = cities[["city_key", "state_code", "city_id"]]
    for side in ("customer", "seller"):
        deliveries = deliveries.merge(
            ids.rename(columns={
                "city_key": f"{side}_city",
                "state_code": f"{side}_state",
                "city_id": f"{side}_city_id",
            }),
            on=[f"{side}_city", f"{side}_state"],
            how="left",
        )
        deliveries[f"{side}_city_id"] = deliveries[f"{side}_city_id"].astype("Int64")
    return deliveries


# ---------------------------------------------------------------- main
DELIVERY_COLUMNS = [
    "order_id", "seller_id",
    "purchase_date", "delivered_date", "estimated_date",
    "delivery_days", "delay_days", "is_delayed",
    "customer_city_id", "customer_zip_prefix", "customer_city", "customer_state",
    "customer_lat", "customer_lng",
    "seller_city_id", "seller_zip_prefix", "seller_city", "seller_state",
    "seller_lat", "seller_lng",
]


def main() -> None:
    raw = load_raw()

    deliveries = build_deliveries(raw)
    cities = build_cities(deliveries, raw["geolocation"])
    deliveries = attach_city_ids(deliveries, cities)[DELIVERY_COLUMNS]

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    deliveries.to_parquet(PROCESSED_DIR / "deliveries.parquet", index=False)
    cities.to_parquet(PROCESSED_DIR / "cities.parquet", index=False)

    orders = deliveries.drop_duplicates("order_id")
    no_id = deliveries["customer_city_id"].isna().sum() + deliveries["seller_city_id"].isna().sum()
    print(f"✔ deliveries: {len(deliveries):,} linhas | {len(orders):,} pedidos")
    print(f"✔ Taxa de atraso: {orders['is_delayed'].mean():.2%}")
    print(f"✔ cities: {len(cities):,} cidades "
          f"({cities['is_destination'].sum():,} destinos | {cities['is_origin'].sum():,} origens)")
    print(f"✔ Cidades sem acento no nome: {(~cities['city_name'].map(has_accent)).sum():,}")
    print(f"{'✔' if no_id == 0 else '⚠'} Linhas sem city_id: {no_id:,}")


if __name__ == "__main__":
    main()