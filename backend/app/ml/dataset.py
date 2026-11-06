"""Monta, a partir dos CSVs da Olist, a base de envios usada no treino do modelo.

Um envio = (pedido, vendedor). Cada linha sai no formato de INPUT_COLUMNS
(features.py) + a coluna alvo `is_delayed`.
"""

from pathlib import Path

import pandas as pd

from app.ml.features import build_zip_table

DATE_COLS = ["order_purchase_timestamp", "order_delivered_customer_date", "order_estimated_delivery_date"]


def load_raw(raw_dir: Path) -> dict[str, pd.DataFrame]:
    return {
        "orders": pd.read_csv(raw_dir / "olist_orders_dataset.csv", parse_dates=DATE_COLS),
        "items": pd.read_csv(raw_dir / "olist_order_items_dataset.csv"),
        "products": pd.read_csv(raw_dir / "olist_products_dataset.csv"),
        "customers": pd.read_csv(raw_dir / "olist_customers_dataset.csv"),
        "sellers": pd.read_csv(raw_dir / "olist_sellers_dataset.csv"),
        "geolocation": pd.read_csv(raw_dir / "olist_geolocation_dataset.csv"),
    }


def build_shipments(raw: dict[str, pd.DataFrame], zip_table: pd.DataFrame) -> pd.DataFrame:
    orders = raw["orders"]

    # 1. Só pedidos entregues e com data de entrega
    delivered = orders[
        (orders["order_status"] == "delivered") & orders["order_delivered_customer_date"].notna()
    ]

    # 2. Itens -> envios (pedido + vendedor), com peso e volume totais
    shipments = (
        raw["items"].merge(raw["products"], on="product_id", how="left")
        .assign(volume_cm3=lambda d: d["product_length_cm"] * d["product_height_cm"] * d["product_width_cm"])
        .groupby(["order_id", "seller_id"], as_index=False)
        .agg(
            n_items=("order_item_id", "size"),
            weight_g=("product_weight_g", lambda s: s.sum(min_count=len(s))),  # NaN se faltar algum produto
            volume_cm3=("volume_cm3", lambda s: s.sum(min_count=len(s))),
        )
    )

    df = (
        shipments.merge(delivered, on="order_id")
        .merge(raw["customers"][["customer_id", "customer_zip_code_prefix"]], on="customer_id")
        .merge(raw["sellers"][["seller_id", "seller_zip_code_prefix"]], on="seller_id")
        .rename(columns={
            "seller_zip_code_prefix": "origin_zip",
            "customer_zip_code_prefix": "destination_zip",
            "order_purchase_timestamp": "purchase_date",
        })
    )

    purchase_day = df["purchase_date"].dt.normalize()
    estimated_day = df["order_estimated_delivery_date"].dt.normalize()
    df["promised_days"] = (estimated_day - purchase_day).dt.days
    df["is_delayed"] = (df["order_delivered_customer_date"].dt.normalize() > estimated_day).astype(int)

    # 3. Elegibilidade (mesmos critérios do notebook 01)
    eligible = (
        df["origin_zip"].isin(zip_table.index)
        & df["destination_zip"].isin(zip_table.index)
        & df["weight_g"].notna()
        & df["volume_cm3"].notna()
        & (df["promised_days"] > 0)
    )
    return df[eligible].sort_values("purchase_date").reset_index(drop=True)


def load_shipments(raw_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Atalho: lê os CSVs e devolve (envios elegíveis, tabela de CEPs)."""
    raw = load_raw(raw_dir)
    zip_table = build_zip_table(raw["geolocation"])
    return build_shipments(raw, zip_table), zip_table