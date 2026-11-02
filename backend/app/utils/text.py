import unicodedata

# Palavras que ficam em minúsculo no meio do nome: "Rio de Janeiro", "Mato Grosso do Sul"
_LOWER_WORDS = {"de", "da", "do", "das", "dos", "e", "em", "del"}


def clean_city(name: str) -> str:
    """Remove sufixos e espaços extras, mantendo acentos: 'São Paulo / SP' -> 'são paulo'"""
    if not isinstance(name, str):
        return name
    for sep in ("/", "\\", ",", " - "):
        name = name.split(sep)[0]
    return " ".join(name.lower().split())


def normalize_city(name: str) -> str:
    """Chave de comparação, sem acentos: 'São Paulo / SP' -> 'sao paulo'"""
    if not isinstance(name, str):
        return name
    name = unicodedata.normalize("NFKD", clean_city(name)).encode("ascii", "ignore").decode()
    return " ".join(name.split())


def has_accent(text: str) -> bool:
    return any(ord(ch) > 127 for ch in text)


def to_display_name(name: str) -> str:
    """Nome para exibição: "santa bárbara d'oeste" -> "Santa Bárbara d'Oeste" """
    result = []
    for i, word in enumerate(clean_city(name).split(" ")):
        if i > 0 and word in _LOWER_WORDS:
            result.append(word)
        elif word.startswith("d'") and len(word) > 2:
            result.append("d'" + word[2:].capitalize())
        else:
            result.append("-".join(part.capitalize() for part in word.split("-")))
    return " ".join(result)