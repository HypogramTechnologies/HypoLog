import pandas as pd


def filtrar_entregas(
    deliveries: pd.DataFrame,
    data_inicio,
    data_fim,
) -> pd.DataFrame:
    """Filtra entregas pela data de compra."""

    inicio = pd.Timestamp(data_inicio)
    fim_exclusivo = pd.Timestamp(data_fim) + pd.Timedelta(days=1)

    return deliveries.loc[
        deliveries["purchase_date"].ge(inicio)
        & deliveries["purchase_date"].lt(fim_exclusivo)
    ].copy()


def formatar_percentual(valor):
    if pd.isna(valor):
        return "N/D"

    return f"{valor:.1f}%".replace(".", ",")


def formatar_decimal(valor, casas=1):
    if pd.isna(valor):
        return "N/D"

    return f"{valor:.{casas}f}".replace(".", ",")


def formatar_inteiro(valor):
    return f"{int(valor):,}".replace(",", ".")


def formatar_atraso(dias):
    """Interpreta corretamente valores negativos e positivos."""

    if pd.isna(dias):
        return "N/D"

    dias = int(dias)

    if dias < 0:
        return f"{abs(dias)} dias antes do prazo"

    if dias == 0:
        return "No prazo"

    return f"{dias} dias de atraso"


def calcular_metricas(df: pd.DataFrame):
    """Calcula indicadores considerando somente status conhecidos."""

    total = len(df)

    status_validos = df["is_delayed"].dropna()

    total_avaliado = len(status_validos)

    atrasadas = int(status_validos.eq(True).sum())
    no_prazo = int(status_validos.eq(False).sum())

    taxa_atraso = (
        atrasadas / total_avaliado * 100
        if total_avaliado
        else None
    )

    pontualidade = (
        no_prazo / total_avaliado * 100
        if total_avaliado
        else None
    )

    tempo_medio = df["delivery_days"].mean()

    atraso_medio = df.loc[
        df["is_delayed"].eq(True),
        "delay_days"
    ].mean()

    return {
        "total": total,
        "total_avaliado": total_avaliado,
        "atrasadas": atrasadas,
        "no_prazo": no_prazo,
        "sem_status": total - total_avaliado,
        "taxa_atraso": taxa_atraso,
        "pontualidade": pontualidade,
        "tempo_medio": tempo_medio,
        "atraso_medio": atraso_medio,
    }


def gerar_indicadores(df: pd.DataFrame):
    metricas = calcular_metricas(df)

    return [
        {
            "nome": "Total de pedidos",
            "valor": formatar_inteiro(metricas["total"]),
        },
        {
            "nome": "Entregas no prazo",
            "valor": formatar_percentual(metricas["pontualidade"]),
        },
        {
            "nome": "Taxa de atraso",
            "valor": formatar_percentual(metricas["taxa_atraso"]),
        },
        {
            "nome": "Tempo médio",
            "valor": (
                f"{formatar_decimal(metricas['tempo_medio'])} dias"
            ),
        },
    ]


def gerar_resumo(df: pd.DataFrame):
    metricas = calcular_metricas(df)
    indicadores = gerar_indicadores(df)

    colunas = [
        "Indicador",
        "Resultado",
    ]

    linhas = [
        [item["nome"], item["valor"]]
        for item in indicadores
    ]

    linhas.extend([
        [
            "Pedidos com status conhecido",
            formatar_inteiro(metricas["total_avaliado"]),
        ],
        [
            "Entregas atrasadas",
            formatar_inteiro(metricas["atrasadas"]),
        ],
        [
            "Entregas sem atraso",
            formatar_inteiro(metricas["no_prazo"]),
        ],
        [
            "Pedidos sem status",
            formatar_inteiro(metricas["sem_status"]),
        ],
        [
            "Atraso médio",
            (
                f"{formatar_decimal(metricas['atraso_medio'])} dias"
            ),
        ],
    ])

    return indicadores, colunas, linhas


def gerar_historico(df: pd.DataFrame):
    colunas = [
    "Data da compra",
    "Cidade",
    "UF",
    "Prazo (dias)",
    "Atraso (dias)",
    "Status",
]

    historico = df.sort_values(
        "purchase_date",
        ascending=False,
    ).head(5000)

    linhas = []

    for _, row in historico.iterrows():
        status = row["is_delayed"]

        if pd.isna(status):
            descricao_status = "Sem informação"
        elif bool(status):
            descricao_status = "Atrasada"
        else:
            descricao_status = "No prazo"

        linhas.append([
        (
            row["purchase_date"].strftime("%d/%m/%Y")
            if pd.notna(row["purchase_date"])
            else "N/D"
        ),
        str(row["customer_city"]),
        str(row["customer_state"]),
        formatar_decimal(row["delivery_days"]),
        formatar_atraso(row["delay_days"]),
        descricao_status,
])

    return colunas, linhas


def gerar_risco_cidades(df: pd.DataFrame):
    """Agrupa entregas por cidade e calcula indicadores reais."""

    dados = df.copy()

    # Remove cidades sem identificação.
    dados = dados.dropna(
        subset=["customer_city", "customer_state"]
    )

    agrupado = (
        dados.groupby(
            ["customer_city", "customer_state"],
            dropna=False,
        )
        .agg(
            pedidos=("order_id", "count"),
            status_avaliados=("is_delayed", "count"),
            atrasos=(
                "is_delayed",
                lambda x: x.eq(True).sum(),
            ),
            tempo_medio=("delivery_days", "mean"),
        )
        .reset_index()
    )

    # Evita divisão por zero.
    agrupado["taxa_atraso"] = (
        agrupado["atrasos"]
        .div(agrupado["status_avaliados"].where(
            agrupado["status_avaliados"] > 0
        ))
        .mul(100)
    )

    agrupado["pontualidade"] = (
        100 - agrupado["taxa_atraso"]
    )

    # Ordena por quantidade de atrasos e taxa.
    agrupado = agrupado.sort_values(
        ["atrasos", "taxa_atraso", "pedidos"],
        ascending=[False, False, False],
        na_position="last",
    ).head(30)

    colunas = [
        "Cidade",
        "UF",
        "Pedidos",
        "Atrasos",
        "Taxa de atraso",
        "Pontualidade",
        "Tempo médio",
    ]

    linhas = []

    for _, row in agrupado.iterrows():
        linhas.append([
            str(row["customer_city"]),
            str(row["customer_state"]),
            formatar_inteiro(row["pedidos"]),
            formatar_inteiro(row["atrasos"]),
            formatar_percentual(row["taxa_atraso"]),
            formatar_percentual(row["pontualidade"]),
            formatar_decimal(row["tempo_medio"]),
        ])

    return colunas, linhas


def gerar_rotas_criticas(df: pd.DataFrame):
    """Identifica as combinações de origem e destino mais críticas."""

    dados = df.dropna(
        subset=[
            "seller_city",
            "seller_state",
            "customer_city",
            "customer_state",
        ]
    )

    agrupado = (
        dados.groupby(
            [
                "seller_city",
                "seller_state",
                "customer_city",
                "customer_state",
            ],
            dropna=False,
        )
        .agg(
            pedidos=("order_id", "count"),
            status_avaliados=("is_delayed", "count"),
            atrasos=(
                "is_delayed",
                lambda x: x.eq(True).sum(),
            ),
            tempo_medio=("delivery_days", "mean"),
        )
        .reset_index()
    )

    agrupado = agrupado[
        agrupado["pedidos"] >= 5
    ].copy()

    agrupado["taxa_atraso"] = (
        agrupado["atrasos"]
        .div(agrupado["status_avaliados"].where(
            agrupado["status_avaliados"] > 0
        ))
        .mul(100)
    )

    agrupado = agrupado.sort_values(
        ["taxa_atraso", "atrasos", "pedidos"],
        ascending=[False, False, False],
        na_position="last",
    ).head(30)

    colunas = [
        "Origem",
        "Destino",
        "Pedidos",
        "Atrasos",
        "Taxa de atraso",
        "Tempo médio",
    ]

    linhas = []

    for _, row in agrupado.iterrows():
        origem = (
            f"{row['seller_city']}/{row['seller_state']}"
        )

        destino = (
            f"{row['customer_city']}/{row['customer_state']}"
        )

        linhas.append([
            origem,
            destino,
            formatar_inteiro(row["pedidos"]),
            formatar_inteiro(row["atrasos"]),
            formatar_percentual(row["taxa_atraso"]),
            formatar_decimal(row["tempo_medio"]),
        ])

    return colunas, linhas


def montar_dados_relatorio(df: pd.DataFrame, tipo: str):
    indicadores = gerar_indicadores(df)

    if tipo == "summary":
        indicadores, colunas, linhas = gerar_resumo(df)
        titulo = "Resumo gerencial"

    elif tipo == "orders":
        colunas, linhas = gerar_historico(df)
        titulo = "Histórico de pedidos"

    elif tipo == "cities":
        colunas, linhas = gerar_risco_cidades(df)
        titulo = "Risco por cidade"

    elif tipo == "routes":
        colunas, linhas = gerar_rotas_criticas(df)
        titulo = "Gargalos e rotas críticas"

    else:
        raise ValueError("Tipo de relatório inválido.")

    return {
        "titulo": titulo,
        "indicadores": indicadores,
        "colunas": colunas,
        "linhas": linhas,
    }