class NotFoundError(Exception):
    """Recurso não encontrado. O main.py converte em HTTP 404."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)