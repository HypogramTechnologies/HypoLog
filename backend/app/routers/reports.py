
import csv
from datetime import date
from io import BytesIO, StringIO

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, model_validator

from app.schemas.reports import RelatorioFiltro
from app.services.report_data_service import (
    filtrar_entregas,
    montar_dados_relatorio,
)
from app.services.pdf_service import gerar_relatorio


router = APIRouter(
    prefix="/reports",
    tags=["Reports"],
)


class ReportRequest(BaseModel):
    tipo: str
    data_inicio: date
    data_fim: date

    @model_validator(mode="after")
    def validar_periodo(self):
        if self.tipo not in ("summary", "orders", "cities", "routes"):
            raise ValueError("Tipo de relatório inválido.")

        if self.data_inicio > self.data_fim:
            raise ValueError(
                "A data inicial não pode ser maior que a final."
            )

        return self


def obter_dados(request: Request, payload: ReportRequest):
    deliveries = request.app.state.deliveries

    inicio_disponivel = deliveries["purchase_date"].min().date()
    fim_disponivel = deliveries["purchase_date"].max().date()

    if (
        payload.data_inicio < inicio_disponivel
        or payload.data_fim > fim_disponivel
    ):
        raise HTTPException(
            status_code=422,
            detail=(
                f"Período disponível: "
                f"{inicio_disponivel} até {fim_disponivel}."
            ),
        )

    df = filtrar_entregas(
        deliveries,
        payload.data_inicio,
        payload.data_fim,
    )

    if df.empty:
        raise HTTPException(
            status_code=404,
            detail="Nenhum pedido encontrado para o período selecionado.",
        )

    return montar_dados_relatorio(df, payload.tipo)


def escrever_linhas_csv(writer, dados, colunas=None):
    """
    Escreve dados tabulares aceitando:
    - Lista de dicionários
    - Lista de listas
    - Lista de tuplas

    Quando as colunas são fornecidas separadamente,
    elas são utilizadas como cabeçalho.
    """

    if dados is None or len(dados) == 0:
        raise HTTPException(
            status_code=404,
            detail="Nenhum dado disponível para exportação.",
        )

    primeira_linha = dados[0]

    # Lista de dicionários
    if isinstance(primeira_linha, dict):
        campos = colunas or list(
            dict.fromkeys(
                campo
                for linha in dados
                for campo in linha.keys()
            )
        )

        writer.writerow(campos)

        for linha in dados:
            writer.writerow([
                linha.get(campo, "")
                for campo in campos
            ])

    # Lista de listas ou tuplas
    elif isinstance(primeira_linha, (list, tuple)):
        if colunas:
            writer.writerow(colunas)

        for linha in dados:
            writer.writerow(linha)

    else:
        raise ValueError(
            "Formato de dados não suportado: "
            f"{type(primeira_linha).__name__}"
        )


def gerar_conteudo_csv(dados, tipo):
    output = StringIO()

    writer = csv.writer(
        output,
        delimiter=";",
        quoting=csv.QUOTE_MINIMAL,
    )

    # RESUMO GERENCIAL
    if tipo == "summary":
        if not isinstance(dados, dict):
            raise ValueError(
                "Estrutura inválida para o resumo gerencial."
            )

        indicadores = dados.get("indicadores", [])
        colunas = dados.get("colunas", [])
        linhas = dados.get("linhas", [])

        # Primeira tabela: indicadores
        if indicadores:
            writer.writerow(["INDICADORES DO RESUMO"])
            writer.writerow(["Indicador", "Resultado"])

            for indicador in indicadores:
                if isinstance(indicador, dict):
                    writer.writerow([
                        indicador.get("nome", ""),
                        indicador.get("valor", ""),
                    ])

            writer.writerow([])

        # Segunda tabela: dados complementares
        if linhas:
            writer.writerow(["DADOS COMPLEMENTARES"])

            escrever_linhas_csv(
                writer,
                linhas,
                colunas if colunas else None,
            )

        # Exporta outras listas presentes no resumo
        # sem duplicar indicadores, colunas e linhas.
        chaves_reservadas = {
            "indicadores",
            "colunas",
            "linhas",
        }

        for chave, valor in dados.items():
            if chave in chaves_reservadas:
                continue

            if isinstance(valor, list) and valor:
                writer.writerow([])
                writer.writerow([chave.upper()])

                if isinstance(valor[0], dict):
                    escrever_linhas_csv(writer, valor)
                elif isinstance(valor[0], (list, tuple)):
                    escrever_linhas_csv(writer, valor)
                else:
                    for item in valor:
                        writer.writerow([item])

        if not indicadores and not linhas:
            raise HTTPException(
                status_code=404,
                detail="Nenhum dado disponível no resumo gerencial.",
            )

    # RELATÓRIOS TABULARES
    elif tipo in ("orders", "cities", "routes"):

        if isinstance(dados, list):
            linhas = dados
            colunas = None

        elif isinstance(dados, dict):
            linhas = dados.get("linhas", [])
            colunas = dados.get("colunas")

        else:
            raise ValueError(
                "Estrutura de relatório não suportada."
            )

        escrever_linhas_csv(
            writer,
            linhas,
            colunas,
        )

    else:
        raise HTTPException(
            status_code=400,
            detail="Tipo de relatório inválido.",
        )

    return output.getvalue().encode("utf-8-sig")


# ============================================================
# PDF
# ============================================================

@router.post("/pdf")
def exportar_pdf(
    dados: RelatorioFiltro,
    request: Request,
):
    try:
        payload = ReportRequest(
            tipo=dados.tipo,
            data_inicio=dados.data_inicio,
            data_fim=dados.data_fim,
        )

        resultado = obter_dados(request, payload)

        pdf = gerar_relatorio(
            resultado,
            dados.data_inicio.strftime("%d/%m/%Y"),
            dados.data_fim.strftime("%d/%m/%Y"),
        )

        nome = (
            f"hypolog-{dados.tipo}-"
            f"{dados.data_inicio}-"
            f"{dados.data_fim}.pdf"
        )

        return StreamingResponse(
            pdf,
            media_type="application/pdf",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="{nome}"'
                ),
                "Cache-Control": "no-store",
            },
        )

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Não foi possível gerar o PDF: {str(error)}",
        ) from error


# ============================================================
# SCHEMA
# ============================================================

@router.get("/schema")
def verificar_schema(request: Request):
    deliveries = request.app.state.deliveries
    cities = request.app.state.cities

    return {
        "deliveries_columns": deliveries.columns.tolist(),
        "cities_columns": cities.columns.tolist(),
        "deliveries_rows": len(deliveries),
        "cities_rows": len(cities),
    }


# ============================================================
# DEBUG CITIES
# ============================================================

@router.get("/debug/cities")
def debug_cities(request: Request):
    df = request.app.state.deliveries

    return {
        "distribuicao_atrasos": {
            str(k): int(v)
            for k, v in df["is_delayed"]
            .value_counts(dropna=False)
            .items()
        },
        "total": len(df),
        "amostra": (
            df.groupby("customer_city")["is_delayed"]
            .agg(["count", "sum", "mean"])
            .head(10)
            .reset_index()
            .to_dict(orient="records")
        ),
    }


# ============================================================
# CSV
# ============================================================

@router.post("/csv")
def exportar_csv(
    payload: ReportRequest,
    request: Request,
):
    try:
        dados = obter_dados(request, payload)

        conteudo = gerar_conteudo_csv(
            dados,
            payload.tipo,
        )

        buffer = BytesIO(conteudo)

        nome = (
            f"hypolog-{payload.tipo}-"
            f"{payload.data_inicio}-"
            f"{payload.data_fim}.csv"
        )

        return StreamingResponse(
            buffer,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="{nome}"'
                ),
                "Cache-Control": "no-store",
            },
        )

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao gerar CSV: {str(error)}",
        ) from error
