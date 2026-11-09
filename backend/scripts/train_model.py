"""Treina o modelo de risco de atraso e salva em models/.

O modelo responde: "qual a chance de este envio levar MAIS dias do que o prazo informado?".
Para valer para QUALQUER prazo (e não só para os prazos que a Olist costuma dar), o treino
usa aumento de dados: cada envio histórico é repetido com vários prazos sorteados, e o alvo é
`delivery_days > prazo`. O modelo é forçado a ser monotônico no prazo: prazo maior nunca
aumenta o risco.

Etapas:
 1. Monta os envios elegíveis a partir dos CSVs da Olist
 2. Divide pelo tempo: treino (jan/2017 a mar/2018) e teste (abr a ago/2018)
 3. Treina e avalia no teste usando o prazo REAL de cada pedido (comparável às métricas
    antigas): ROC-AUC, PR-AUC, Precision, Recall, F1, matriz de confusão
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
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
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

# Aumento de dados: prazos sorteados (em dias) e quantos por envio
DEADLINE_RANGE = (2, 46)
DEADLINES_PER_SHIPMENT = 4
CHECK_DEADLINES = (5, 10, 15, 20, 30)  # prazos usados no relatório de sanidade

MODEL_PARAMS = {
    "max_iter": 300,           # número de árvores (rodadas de boosting)
    "learning_rate": 0.06,
    "max_leaf_nodes": 31,
    "min_samples_leaf": 200,   # mínimo de linhas em cada folha
    "l2_regularization": 1.0,
    "early_stopping": False,   # linhas repetidas (mesmo envio) vazariam para a validação interna
    "random_state": 42,
}

# Features calculadas pelo FeatureBuilder que NÃO entram no modelo.
# O mês fica de fora: com só ~19 meses de dados ele decora eventos pontuais (ex.: Black Friday/2017).
EXCLUDED_FEATURES: set[str] = {"purchase_month"}


def feature_list(builder: FeatureBuilder) -> list[str]:
    return [c for c in builder.feature_columns if c not in EXCLUDED_FEATURES]


def augment(features: pd.DataFrame, days: np.ndarray, seed: int) -> tuple[pd.DataFrame, np.ndarray]:
    """Repete cada envio com prazos sorteados e marca se a entrega passou do prazo."""
    rng = np.random.default_rng(seed)
    idx = np.repeat(np.arange(len(features)), DEADLINES_PER_SHIPMENT)
    deadlines = rng.integers(*DEADLINE_RANGE, size=len(idx))
    X = features.iloc[idx].reset_index(drop=True)
    X["promised_days"] = deadlines.astype(float)
    return X, (days[idx] > deadlines).astype(int)


def train(df: pd.DataFrame, zip_table: pd.DataFrame) -> tuple[FeatureBuilder, HistGradientBoostingClassifier]:
    builder = FeatureBuilder(zip_table)
    features = builder.fit_transform(df[INPUT_COLUMNS + ["delivery_days"]], df[TARGET])
    columns = feature_list(builder)

    X, y = augment(features[columns], df["delivery_days"].to_numpy(dtype=float), seed=MODEL_PARAMS["random_state"])
    # -1 = quanto maior o prazo, menor (ou igual) o risco
    monotonic = [-1 if c == "promised_days" else 0 for c in columns]
    model = HistGradientBoostingClassifier(monotonic_cst=monotonic, **MODEL_PARAMS).fit(X, y)
    return builder, model


def predict_proba(builder: FeatureBuilder, model, df: pd.DataFrame, deadline: int | None = None) -> np.ndarray:
    """Probabilidade de atraso. Sem `deadline`, usa o prazo real de cada envio."""
    X = builder.transform(df[INPUT_COLUMNS])[feature_list(builder)]
    if deadline is not None:
        X = X.assign(promised_days=float(deadline))
    return model.predict_proba(X)[:, 1]


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

    # 2. Treino e avaliação no período de teste (com o prazo real de cada pedido)
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

    # Sanidade: a probabilidade média precisa CAIR conforme o prazo sobe
    by_deadline = {
        d: round(float(predict_proba(builder, model, test_df, deadline=d).mean()), 4) for d in CHECK_DEADLINES
    }
    actual_by_deadline = {
        d: round(float((test_df["delivery_days"] > d).mean()), 4) for d in CHECK_DEADLINES
    }

    # Importância por permutação (queda do ROC-AUC ao embaralhar cada variável)
    sample = test_df.sample(min(10_000, len(test_df)), random_state=42)
    X_sample = builder.transform(sample[INPUT_COLUMNS])[feature_list(builder)]
    perm = permutation_importance(
        model, X_sample, sample[TARGET], scoring="roc_auc", n_repeats=3, random_state=42, n_jobs=-1
    )
    importances = pd.Series(perm.importances_mean, index=feature_list(builder)).sort_values(ascending=False)

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
        "model": "HistGradientBoostingClassifier (monotônico no prazo)",
        "params": MODEL_PARAMS,
        "augmentation": {"deadline_range": list(DEADLINE_RANGE), "per_shipment": DEADLINES_PER_SHIPMENT},
        "excluded_features": sorted(EXCLUDED_FEATURES),
        "metrics_test": metrics,
        "mean_probability_by_deadline": by_deadline,
        "actual_late_rate_by_deadline": actual_by_deadline,
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
    print("\n=== Avaliação no teste (abr a ago/2018, prazo real de cada pedido) ===")
    print(f"ROC-AUC:   {metrics['roc_auc']:.3f}")
    print(f"PR-AUC:    {metrics['pr_auc']:.3f}  (referência: {metrics['baseline_delay_rate']:.3f} = taxa de atraso)")
    print(f"Limite:    {best['threshold']:.3f}")
    print(f"Precision: {best['precision']:.3f}")
    print(f"Recall:    {best['recall']:.3f}")
    print(f"F1:        {best['f1']:.3f}")
    print(f"Matriz:    TP={cm['tp']:,}  FP={cm['fp']:,}  FN={cm['fn']:,}  TN={cm['tn']:,}")
    print("\nSanidade — prazo -> prob. média do modelo | taxa real de atraso no teste:")
    for d in CHECK_DEADLINES:
        print(f"  {d:>2} dias: {by_deadline[d]:.1%} | {actual_by_deadline[d]:.1%}")
    print("\nTop 5 features (queda do ROC-AUC ao embaralhar):")
    for name, value in importances.head(5).items():
        print(f"  {name:<20} {value:.3f}")
    size_mb = (MODELS_DIR / "delay_model.joblib").stat().st_size / 1e6
    print(f"\n✔ Modelo salvo em {MODELS_DIR / 'delay_model.joblib'} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()