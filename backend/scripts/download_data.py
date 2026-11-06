"""Baixa o dataset da Olist do Kaggle e copia os CSVs necessários para data/raw/.

"""

import shutil
from pathlib import Path

import kagglehub

RAW_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
DATASET = "olistbr/brazilian-ecommerce"
FILES = [
    "olist_orders_dataset.csv",
    "olist_order_items_dataset.csv",
    "olist_customers_dataset.csv",
    "olist_sellers_dataset.csv",
    "olist_geolocation_dataset.csv",
    "olist_products_dataset.csv",
]


def main() -> None:
    cache_dir = Path(kagglehub.dataset_download(DATASET))
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    for name in FILES:
        shutil.copy2(cache_dir / name, RAW_DIR / name)
        print(f"✔ {name}")

    print(f"\nArquivos copiados para {RAW_DIR}")


if __name__ == "__main__":
    main()