from pydantic import BaseModel, Field


class CityFilters(BaseModel):
    search: str | None = Field(None, description="Parte do nome, sem diferenciar acentos (ex.: 'sao jo')")
    state: str | None = Field(None, min_length=2, max_length=2, description="Sigla da UF (ex.: 'SP')")


class City(BaseModel):
    city_id: int
    city_name: str
    state_id: int
    state_code: str
    state_name: str