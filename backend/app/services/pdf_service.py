
from pathlib import Path
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
)


# --------------------------------------------------
# IDENTIDADE VISUAL HYPOLOG
# --------------------------------------------------

PRIMARY = colors.HexColor("#3A63DB")
PRIMARY_FOREGROUND = colors.HexColor("#FFFFFF")

FOREGROUND = colors.HexColor("#252B45")
MUTED_FOREGROUND = colors.HexColor("#69738F")

BACKGROUND = colors.HexColor("#F8FAFC")
CARD = colors.white
MUTED = colors.HexColor("#F3F5FA")
SECONDARY = colors.HexColor("#E8EAF5")
BORDER = colors.HexColor("#E1E5EF")

BASE_DIR = Path(__file__).resolve().parents[1]
LOGO_PATH = BASE_DIR / "assets" / "hypolog_logo.png"


# --------------------------------------------------
# ESTILOS
# --------------------------------------------------

def criar_estilos():

    estilos = getSampleStyleSheet()

    estilos.add(
        ParagraphStyle(
            name="ReportTitle",
            parent=estilos["Title"],
            fontName="Helvetica-Bold",
            fontSize=19,
            leading=24,
            textColor=FOREGROUND,
            alignment=TA_LEFT,
            spaceAfter=5,
        )
    )

    estilos.add(
        ParagraphStyle(
            name="ReportSubtitle",
            parent=estilos["Normal"],
            fontSize=9,
            leading=14,
            textColor=MUTED_FOREGROUND,
            alignment=TA_LEFT,
        )
    )

    estilos.add(
        ParagraphStyle(
            name="SectionTitle",
            parent=estilos["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=16,
            textColor=FOREGROUND,
            spaceBefore=8,
            spaceAfter=10,
        )
    )

    estilos.add(
        ParagraphStyle(
            name="IndicatorLabel",
            parent=estilos["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=12,
            textColor=MUTED_FOREGROUND,
            alignment=TA_CENTER,
            spaceAfter=7,
        )
    )

    estilos.add(
        ParagraphStyle(
            name="IndicatorValue",
            parent=estilos["Normal"],
            fontName="Helvetica-Bold",
            fontSize=17,
            leading=22,
            textColor=PRIMARY,
            alignment=TA_CENTER,
        )
    )

    estilos.add(
        ParagraphStyle(
            name="TableHeader",
            parent=estilos["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=10,
            textColor=PRIMARY_FOREGROUND,
        )
    )

    estilos.add(
        ParagraphStyle(
            name="TableCell",
            parent=estilos["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=10,
            textColor=FOREGROUND,
            wordWrap="CJK",
        )
    )

    return estilos


# --------------------------------------------------
# LOGO
# --------------------------------------------------

def criar_logo():

    if not LOGO_PATH.exists():
        raise FileNotFoundError(
            f"Logo não encontrada: {LOGO_PATH}"
        )

    imagem = ImageReader(str(LOGO_PATH))

    largura_original, altura_original = imagem.getSize()

    largura = 36 * mm
    altura = largura * altura_original / largura_original

    logo = Image(
        str(LOGO_PATH),
        width=largura,
        height=altura,
    )

    logo.hAlign = "LEFT"

    return logo


# --------------------------------------------------
# CABEÇALHO
# --------------------------------------------------

def criar_cabecalho(
    dados,
    data_inicio,
    data_fim,
    estilos,
    largura_pagina,
):

    logo = criar_logo()

    informacoes = [
        Paragraph(
            dados["titulo"],
            estilos["ReportTitle"],
        ),
        Paragraph(
            f"Período: {data_inicio} até {data_fim}",
            estilos["ReportSubtitle"],
        ),
    ]

    tabela = Table(
        [[logo, informacoes]],
        colWidths=[
            48 * mm,
            largura_pagina - 48 * mm,
        ],
    )

    tabela.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (0, 0), "LEFT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ])
    )

    return tabela


# --------------------------------------------------
# INDICADORES
# --------------------------------------------------

def criar_indicadores(indicadores, largura, estilos):

    if not indicadores:
        return []

    quantidade = len(indicadores)
    largura_card = largura / quantidade

    cards = []

    for indicador in indicadores:

        label = Paragraph(
            str(indicador["nome"]),
            estilos["IndicatorLabel"],
        )

        valor = Paragraph(
            str(indicador["valor"]),
            estilos["IndicatorValue"],
        )

        cards.append([
            label,
            Spacer(1, 3 * mm),
            valor,
        ])

    tabela = Table(
        [cards],
        colWidths=[largura_card] * quantidade,
    )

    tabela.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), MUTED),
            ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.6, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 13),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 13),
        ])
    )

    return [
        Paragraph("Indicadores gerais", estilos["SectionTitle"]),
        tabela,
        Spacer(1, 8 * mm),
    ]


# --------------------------------------------------
# TABELA DE DADOS
# --------------------------------------------------

def criar_tabela(colunas, linhas, largura, estilos):

    if not colunas:
        return []

    quantidade = len(colunas)

    dados = [
        [
            Paragraph(
                str(coluna),
                estilos["TableHeader"],
            )
            for coluna in colunas
        ]
    ]

    for linha in linhas:

        dados.append([
            Paragraph(
                str(valor),
                estilos["TableCell"],
            )
            for valor in linha
        ])

    tabela = Table(
        dados,
        colWidths=[largura / quantidade] * quantidade,
        repeatRows=1,
        hAlign="LEFT",
    )

    tabela.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
            ("TEXTCOLOR", (0, 0), (-1, 0), PRIMARY_FOREGROUND),
            ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
            (
                "ROWBACKGROUNDS",
                (0, 1),
                (-1, -1),
                [CARD, BACKGROUND],
            ),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ])
    )

    return tabela


# --------------------------------------------------
# RODAPÉ
# --------------------------------------------------

def criar_rodape(canvas, documento):

    canvas.saveState()

    largura, altura = documento.pagesize

    canvas.setStrokeColor(BORDER)

    canvas.line(
        12 * mm,
        14 * mm,
        largura - 12 * mm,
        14 * mm,
    )

    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED_FOREGROUND)

    canvas.drawString(
        12 * mm,
        9 * mm,
        "HypoLog | Relatório gerado automaticamente",
    )

    canvas.drawRightString(
        largura - 12 * mm,
        9 * mm,
        f"Página {documento.page}",
    )

    canvas.restoreState()


# --------------------------------------------------
# GERADOR PRINCIPAL
# --------------------------------------------------

def gerar_relatorio(
    dados: dict,
    data_inicio: str,
    data_fim: str,
):

    buffer = BytesIO()

    colunas = dados["colunas"]
    linhas = dados["linhas"]

    # Relatórios mais largos usam orientação paisagem.
    usar_paisagem = len(colunas) >= 6

    tamanho_pagina = (
        landscape(A4)
        if usar_paisagem
        else A4
    )

    largura_pagina = tamanho_pagina[0] - 24 * mm

    documento = SimpleDocTemplate(
        buffer,
        pagesize=tamanho_pagina,
        rightMargin=12 * mm,
        leftMargin=12 * mm,
        topMargin=15 * mm,
        bottomMargin=20 * mm,
        title=dados["titulo"],
        author="HypoLog",
    )

    estilos = criar_estilos()

    elementos = []

    # Cabeçalho com logo
    elementos.append(
        criar_cabecalho(
            dados,
            data_inicio,
            data_fim,
            estilos,
            largura_pagina,
        )
    )

    elementos.append(
        Spacer(1, 6 * mm)
    )

    # Indicadores
    elementos.extend(
        criar_indicadores(
            dados["indicadores"],
            largura_pagina,
            estilos,
        )
    )

    # Detalhamento
    if colunas:

        elementos.append(
            Paragraph(
                "Detalhamento",
                estilos["SectionTitle"],
            )
        )

        if linhas:
            elementos.append(
                criar_tabela(
                    colunas,
                    linhas,
                    largura_pagina,
                    estilos,
                )
            )
        else:
            elementos.append(
                Paragraph(
                    "Nenhum registro encontrado para o período selecionado.",
                    estilos["ReportSubtitle"],
                )
            )

    documento.build(
        elementos,
        onFirstPage=criar_rodape,
        onLaterPages=criar_rodape,
    )

    buffer.seek(0)

    return buffer
