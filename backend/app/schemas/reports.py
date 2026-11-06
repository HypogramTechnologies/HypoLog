
from datetime import date
from typing import Literal

from pydantic import BaseModel, model_validator


class RelatorioFiltro(BaseModel):
    tipo: Literal["summary", "orders", "cities", "routes"]

    data_inicio: date
    data_fim: date

    @model_validator(mode="after")
    def validar_periodo(self):
        if self.data_inicio > self.data_fim:
            raise ValueError(
                "Data inicial não pode ser maior que a data final."
            )

        return self

