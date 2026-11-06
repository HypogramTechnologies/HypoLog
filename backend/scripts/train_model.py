"""Treina o modelo de risco de atraso (Random Forest) e salva em models/.

Etapas:
 1. Monta os envios elegíveis a partir dos CSVs da Olist
 2. Divide pelo tempo: treino (jan/2017 a mar/2018) e teste (abr a ago/2018)
 3. Treina e avalia no teste: ROC-AUC, Precision, Recall, F1, matriz de confusão
 4. Escolhe o limite de decisão (maior F1 no teste)
 5. Retreina com o período inteiro e salva o modelo para a API

Uso (dentro de backend/):  python -m scripts.train_model
"""

import json
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)

from app.ml.dataset import load_shipments
from app.ml.features import INPUT_COLUMNS, FeatureBuilder

BASE_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = BASE_DIR / "data" / "raw"
MODELS_DIR = BASE_DIR / "models"

START, SPLIT, END = "2017-01-01", "2018-04-01", "2018-09-01"
TARGET = "is_delayed"

RF_PARAMS = {
    "n_estimators": 200,      # quantidade de árvores
    "max_depth": 12,          # perguntas em sequência por árvore
    "min_samples_leaf": 20,   # mínimo de envios em cada resposta final
    "class_weight": None,     # sem rebalancear: a probabilidade fica mais próxima da real
    "n_jobs": -1,             # usa todos os núcleos do processador
    "random_state": 42,       # resultados reproduzíveis
}

# Features calculadas pelo FeatureBuilder que NÃO entram no modelo
EXCLUDED_FEATURES: set[str] = set()


def feature_list(builder: FeatureBuilder) -> list[str]:
    return [c for c in builder.feature_columns if c not in EXCLUDED_FEATURES]


def train(df: pd.DataFrame, zip_table: pd.DataFrame) -> tuple[FeatureBuilder, RandomForestClassifier]:
    builder = FeatureBuilder(zip_table)
    X = builder.fit_transform(df[INPUT_COLUMNS], df[TARGET])
    model = RandomForestClassifier(**RF_PARAMS).fit(X[feature_list(builder)], df[TARGET])
    return builder, model


def predict_proba(builder: FeatureBuilder, model, df: pd.DataFrame) -> np.ndarray:
    X = builder.transform(df[INPUT_COLUMNS])
    return model.predict_proba(X[feature_list(builder)])[:, 1]


def best_threshold(y_true, proba) -> float:
    """Limite de probabilidade que dá o maior F1 (equilíbrio entre Precision e Recall)."""
    precision, recall, thresholds = precision_recall_curve(y_true, proba)
    f1 = 2 * precision * recall / np.clip(precision + recall, 1e-9, None)
    return float(thresholds[np.argmax(f1[:-1])])


def metrics_at(y_true, proba, threshold: float) -> dict:
    y_pred = (proba >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    return {
        "threshold": round(threshold, 4),
        "precision": round(precision_score(y_true, y_pred, zero_division=0), 4),
        "recall": round(recall_score(y_true, y_pred, zero_division=0), 4),
        "f1": round(f1_score(y_true, y_pred, zero_division=0), 4),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


def main() -> None:
    # 1. Dados
    print("Montando envios...")
    shipments, zip_table = load_shipments(RAW_DIR)
    window = shipments[(shipments["purchase_date"] >= START) & (shipments["purchase_date"] < END)]
    train_df = window[window["purchase_date"] < SPLIT]
    test_df = window[window["purchase_date"] >= SPLIT]
    print(f"  treino: {len(train_df):,} envios ({train_df[TARGET].mean():.2%} atrasados)")
    print(f"  teste:  {len(test_df):,} envios ({test_df[TARGET].mean():.2%} atrasados)")

    # 2. Treino e avaliação no período de teste
    print("Treinando e avaliando...")
    builder, model = train(train_df, zip_table)
    proba = predict_proba(builder, model, test_df)
    y_test = test_df[TARGET].to_numpy()

    threshold = best_threshold(y_test, proba)
    metrics = {
        "roc_auc": round(roc_auc_score(y_test, proba), 4),
        "pr_auc": round(average_precision_score(y_test, proba), 4),
        "baseline_delay_rate": round(float(y_test.mean()), 4),
        "at_best_threshold": metrics_at(y_test, proba, threshold),
        "at_0_5": metrics_at(y_test, proba, 0.5),
    }
    importances = (
        pd.Series(model.feature_importances_, index=feature_list(builder))
        .sort_values(ascending=False)
    )

    # 3. Modelo final: retreina com o período inteiro (treino + teste)
    print("Retreinando com o período completo...")
    final_builder, final_model = train(window, zip_table)

    # Faixas de risco: alto >= limite; médio >= metade do limite; baixo abaixo disso
    risk_bands = {"medium": round(threshold / 2, 4), "high": round(threshold, 4)}

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    report = {
        "trained_at": datetime.now().isoformat(timespec="seconds"),
        "periods": {"train": [START, SPLIT], "test": [SPLIT, END], "final_model": [START, END]},
        "sizes": {"train": len(train_df), "test": len(test_df), "final_model": len(window)},
        "params": RF_PARAMS,
        "excluded_features": sorted(EXCLUDED_FEATURES),
        "metrics_test": metrics,
        "risk_bands": risk_bands,
        "feature_importances": importances.round(4).to_dict(),
    }
    joblib.dump(
        {
            "model": final_model,
            "feature_builder": final_builder,
            "feature_columns": feature_list(final_builder),
            "risk_bands": risk_bands,
            "report": report,
        },
        MODELS_DIR / "delay_model.joblib",
        compress=3,
    )
    (MODELS_DIR / "metrics.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    pd.DataFrame({"purchase_date": test_df["purchase_date"].to_numpy(), "y_true": y_test, "proba": proba}).to_parquet(
        MODELS_DIR / "test_predictions.parquet", index=False
    )

    # 4. Resumo
    best = metrics["at_best_threshold"]
    cm = best["confusion_matrix"]
    print("\n=== Avaliação no teste (abr a ago/2018) ===")
    print(f"ROC-AUC:   {metrics['roc_auc']:.3f}")
    print(f"PR-AUC:    {metrics['pr_auc']:.3f}  (referência: {metrics['baseline_delay_rate']:.3f} = taxa de atraso)")
    print(f"Limite:    {best['threshold']:.3f}")
    print(f"Precision: {best['precision']:.3f}")
    print(f"Recall:    {best['recall']:.3f}")
    print(f"F1:        {best['f1']:.3f}")
    print(f"Matriz:    TP={cm['tp']:,}  FP={cm['fp']:,}  FN={cm['fn']:,}  TN={cm['tn']:,}")
    print("\nTop 5 features:")
    for name, value in importances.head(5).items():
        print(f"  {name:<20} {value:.3f}")
    size_mb = (MODELS_DIR / "delay_model.joblib").stat().st_size / 1e6
    print(f"\n✔ Modelo salvo em {MODELS_DIR / 'delay_model.joblib'} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()