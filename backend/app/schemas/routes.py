from datetime import date

from pydantic import BaseModel, Field, model_validator

from app.schemas.cities import City


# ---------- Entrada ----------
class CriticalRouteFilters(BaseModel):
    city_id: int = Field(..., ge=1, description="Cidade de DESTINO (GET /cities)")
    start_date: date | None = Field(None, description="Início do período (data da compra)")
    end_date: date | None = Field(None, description="Fim do período (inclusivo)")
    limit: int = Field(5, ge=1, le=50, description="Quantidade de rotas no ranking")
    min_orders: int = Field(5, ge=1, description="Mínimo de pedidos para a rota entrar no ranking")

    @model_validator(mode="after")
    def _check_period(self):
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("'start_date' deve ser menor ou igual a 'end_date'")
        return self


# ---------- Saída ----------
class CriticalRoute(BaseModel):
    rank: int
    origin: City
    total_orders: int
    delayed_orders: int
    delay_rate: float = Field(description="Percentual de pedidos atrasados (0-100)")
    avg_delivery_days: float = Field(description="Tempo médio entre compra e entrega, em dias")
    avg_delay_days: float | None = Field(description="Média de dias de atraso, só entre os pedidos atrasados")


class CriticalRoutes(BaseModel):
    destination: City
    routes: list[CriticalRoute]