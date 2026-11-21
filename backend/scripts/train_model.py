"""Treina o modelo de risco de atraso (Random Forest) e salva em models/.

Etapas:
 1. Monta os envios elegíveis a partir dos CSVs da Olist (jan/2017 a ago/2018)
 2. Divide de forma ALEATÓRIA e ESTRATIFICADA: 60% treino, 20% validação, 20% teste
    (estratificada = as três partes ficam com a mesma proporção de atrasos)
 3. Treina no treino; escolhe o limite de decisão (maior F1) na VALIDAÇÃO
 4. Avalia UMA vez no teste: ROC-AUC, PR-AUC, Precision, Recall, F1, matriz de confusão
 5. Teste de robustez: repete o treino com divisão TEMPORAL (treina até mar/2018,
    testa em abr-ago/2018) para mostrar como o modelo se sai prevendo meses futuros
 6. Retreina com todos os dados e salva o modelo para a API

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
from sklearn.model_selection import train_test_split

from app.ml.dataset import load_shipments
from app.ml.features import INPUT_COLUMNS, FeatureBuilder

BASE_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = BASE_DIR / "data" / "raw"
MODELS_DIR = BASE_DIR / "models"

START, END = "2017-01-01", "2018-09-01"
TEMPORAL_SPLIT = "2018-04-01"            # só para o teste de robustez
SPLIT_SIZES = {"train": 0.6, "validation": 0.2, "test": 0.2}
SEED = 42
TARGET = "is_delayed"
TRAIN_COLUMNS = INPUT_COLUMNS + ["delivery_days"]  # delivery_days só alimenta os históricos

RF_PARAMS = {
    "n_estimators": 300,      # quantidade de árvores
    "max_depth": 20,          # perguntas em sequência por árvore
    "min_samples_leaf": 10,   # mínimo de envios em cada resposta final
    "max_features": 0.3,      # cada pergunta sorteia 30% das features para escolher a melhor
    "class_weight": None,     # sem rebalancear: a probabilidade fica mais próxima da real
    "n_jobs": -1,             # usa todos os núcleos do processador
    "random_state": SEED,     # resultados reproduzíveis
}

# Features calculadas pelo FeatureBuilder que NÃO entram no modelo
EXCLUDED_FEATURES: set[str] = set()


def feature_list(builder: FeatureBuilder) -> list[str]:
    return [c for c in builder.feature_columns if c not in EXCLUDED_FEATURES]


def split_random(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """60/20/20 aleatório e estratificado pelo atraso."""
    rest = SPLIT_SIZES["validation"] + SPLIT_SIZES["test"]
    train, tmp = train_test_split(df, test_size=rest, stratify=df[TARGET], random_state=SEED)
    validation, test = train_test_split(
        tmp, test_size=SPLIT_SIZES["test"] / rest, stratify=tmp[TARGET], random_state=SEED
    )
    return tuple(d.reset_index(drop=True) for d in (train, validation, test))


def train(df: pd.DataFrame, zip_table: pd.DataFrame) -> tuple[FeatureBuilder, RandomForestClassifier]:
    builder = FeatureBuilder(zip_table)
    X = builder.fit_transform(df[TRAIN_COLUMNS], df[TARGET])
    model = RandomForestClassifier(**RF_PARAMS).fit(X[feature_list(builder)], df[TARGET])
    return builder, model


def predict_proba(builder: FeatureBuilder, model, df: pd.DataFrame) -> np.ndarray:
    X = builder.transform(df[INPUT_COLUMNS])
    return model.predict_proba(X[feature_list(builder)])[:, 1]


def best_threshold(y_true, proba) -> float:
    """Limite de probabilidade que dá o maior F1 (equilíbrio entre Precision e Recall).
    Testa todos os limites possíveis (precision_recall_curve) e fica com o de maior F1."""
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
    window = window.reset_index(drop=True)

    # 2. Divisão aleatória estratificada
    train_df, val_df, test_df = split_random(window)
    for name, part in (("treino", train_df), ("validação", val_df), ("teste", test_df)):
        print(f"  {name:<10} {len(part):>6,} envios ({part[TARGET].mean():.2%} atrasados)")

    # 3. Treino + limite escolhido na validação
    print("Treinando e escolhendo o limite na validação...")
    builder, model = train(train_df, zip_table)
    proba_val = predict_proba(builder, model, val_df)
    threshold = best_threshold(val_df[TARGET].to_numpy(), proba_val)

    # 4. Avaliação no teste (usado uma única vez)
    proba = predict_proba(builder, model, test_df)
    y_test = test_df[TARGET].to_numpy()
    metrics = {
        "roc_auc": round(roc_auc_score(y_test, proba), 4),
        "pr_auc": round(average_precision_score(y_test, proba), 4),
        "baseline_delay_rate": round(float(y_test.mean()), 4),
        "validation_roc_auc": round(roc_auc_score(val_df[TARGET], proba_val), 4),
        "at_best_threshold": metrics_at(y_test, proba, threshold),
        "at_0_5": metrics_at(y_test, proba, 0.5),
    }
    # Importância nativa do Random Forest (quanto cada feature "limpou" as divisões das árvores)
    importances = (
        pd.Series(model.feature_importances_, index=feature_list(builder))
        .sort_values(ascending=False)
    )

    # 5. Robustez: divisão temporal (prever meses que o modelo nunca viu)
    print("Teste de robustez com divisão temporal...")
    past = window[window["purchase_date"] < TEMPORAL_SPLIT].reset_index(drop=True)
    future = window[window["purchase_date"] >= TEMPORAL_SPLIT].reset_index(drop=True)
    t_builder, t_model = train(past, zip_table)
    t_proba = predict_proba(t_builder, t_model, future)
    temporal = {
        "train_period": [START, TEMPORAL_SPLIT],
        "test_period": [TEMPORAL_SPLIT, END],
        "roc_auc": round(roc_auc_score(future[TARGET], t_proba), 4),
        "pr_auc": round(average_precision_score(future[TARGET], t_proba), 4),
        "baseline_delay_rate": round(float(future[TARGET].mean()), 4),
    }

    # 6. Modelo final: retreina com todos os envios do período
    print("Retreinando com todos os dados...")
    final_builder, final_model = train(window, zip_table)

    # Faixas de risco: alto >= limite; médio >= metade do limite; baixo abaixo disso
    risk_bands = {"medium": round(threshold / 2, 4), "high": round(threshold, 4)}

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    report = {
        "trained_at": datetime.now().isoformat(timespec="seconds"),
        "split": "aleatória estratificada 60/20/20 (limite escolhido na validação)",
        "periods": {"data": [START, END]},
        "sizes": {"train": len(train_df), "validation": len(val_df), "test": len(test_df),
                  "final_model": len(window)},
        "params": RF_PARAMS,
        "excluded_features": sorted(EXCLUDED_FEATURES),
        "metrics_test": metrics,
        "temporal_check": temporal,
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

    # 7. Resumo
    best = metrics["at_best_threshold"]
    cm = best["confusion_matrix"]
    print("\n=== Avaliação no teste (20% aleatório e estratificado) ===")
    print(f"ROC-AUC:   {metrics['roc_auc']:.3f}  (validação: {metrics['validation_roc_auc']:.3f})")
    print(f"PR-AUC:    {metrics['pr_auc']:.3f}  (referência: {metrics['baseline_delay_rate']:.3f} = taxa de atraso)")
    print(f"Limite:    {best['threshold']:.3f}  (escolhido na validação)")
    print(f"Precision: {best['precision']:.3f}")
    print(f"Recall:    {best['recall']:.3f}")
    print(f"F1:        {best['f1']:.3f}")
    print(f"Matriz:    TP={cm['tp']:,}  FP={cm['fp']:,}  FN={cm['fn']:,}  TN={cm['tn']:,}")
    print(f"\nRobustez (divisão temporal, abr-ago/2018): ROC-AUC {temporal['roc_auc']:.3f} | "
          f"PR-AUC {temporal['pr_auc']:.3f} (referência {temporal['baseline_delay_rate']:.3f})")
    print("\nTop 5 features:")
    for name, value in importances.head(5).items():
        print(f"  {name:<24} {value:.3f}")
    size_mb = (MODELS_DIR / "delay_model.joblib").stat().st_size / 1e6
    print(f"\n✔ Modelo salvo em {MODELS_DIR / 'delay_model.joblib'} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
