"""Compara a previsão do simulador com o histórico real de uma rota (UF -> UF).

Uso (dentro de backend/):
    python -m scripts.check_route SP RJ 15
    (origem, destino, prazo em dias)

Mostra, entre os envios reais da base, a % que levou MAIS dias que o prazo informado.
"""
import sys
from pathlib import Path

import pandas as pd

from app.ml.dataset import load_shipments

RAW_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
RECENT_FROM = "2018-04-01"  # mesmo período do teste do modelo


def summarize(shipments: pd.DataFrame, zip_table: pd.DataFrame, origin: str, dest: str, days: int) -> pd.DataFrame:
    state = zip_table["state"]
    route = shipments[
        (shipments["origin_zip"].map(state) == origin) & (shipments["destination_zip"].map(state) == dest)
    ]
    recent = route[route["purchase_date"] >= RECENT_FROM]
    rows = []
    for label, part in (("Período todo (2017 a ago/2018)", route), ("Recente (abr a ago/2018)", recent)):
        rows.append({
            "período": label,
            "envios": len(part),
            f"% com mais de {days} dias": round(100 * float((part["delivery_days"] > days).mean()), 1) if len(part) else None,
            "mediana de dias": float(part["delivery_days"].median()) if len(part) else None,
        })
    return pd.DataFrame(rows)


def main() -> None:
    if len(sys.argv) != 4:
        sys.exit("Uso: python -m scripts.check_route SP RJ 15")
    origin, dest, days = sys.argv[1].upper(), sys.argv[2].upper(), int(sys.argv[3])
    shipments, zip_table = load_shipments(RAW_DIR)
    print(f"\nRota {origin} -> {dest}, prazo de {days} dias\n")
    print(summarize(shipments, zip_table, origin, dest, days).to_string(index=False))


if __name__ == "__main__":
    main()