class NotFoundError(Exception):
    """Recurso não encontrado. O main.py converte em HTTP 404."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class InvalidInputError(Exception):
    """Dado válido no formato, mas impossível de processar. O main.py converte em HTTP 422."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class ModelUnavailableError(Exception):
    """Modelo de ML não carregado. O main.py converte em HTTP 503."""

    def __init__(self, message: str = "Modelo de previsão indisponível. Rode: python -m scripts.train_model"):
        self.message = message
        super().__init__(message)
