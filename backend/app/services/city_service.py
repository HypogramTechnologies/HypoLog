from app.core.exceptions import NotFoundError
from app.repositories.city_repository import CityRepository
from app.schemas.cities import City, CityFilters
from app.utils.text import normalize_city

def get_city_or_raise(repository: CityRepository, city_id: int) -> City:
    """Busca a cidade pelo id ou lança NotFoundError (vira 404)."""
    row = repository.get_by_id(city_id)
    if row is None:
        raise NotFoundError(f"Cidade {city_id} não encontrada")
    return City.model_validate(row)

class CityService:
    def __init__(self, repository: CityRepository):
        self._repository = repository

    def list_destinations(self, filters: CityFilters) -> list[City]:
        search_key = normalize_city(filters.search) if filters.search else None
        state_code = filters.state.upper() if filters.state else None

        cities = self._repository.find_destinations(search_key, state_code)

        # Ordena pela chave sem acento: por city_name, "Águas Lindas" iria para depois de "Zé Doca"
        sort_cols, ascending = ["city_key", "state_code"], [True, True]

        # Com busca, quem COMEÇA com o termo aparece primeiro ("sao" -> "São Paulo" antes de "Muquém do São...")
        if search_key:
            cities = cities.assign(_starts=cities["city_key"].str.startswith(search_key))
            sort_cols, ascending = ["_starts", *sort_cols], [False, *ascending]

        cities = cities.sort_values(sort_cols, ascending=ascending)

        # Campos extras (city_key, is_destination...) são ignorados pelo schema
        return [City.model_validate(row) for row in cities.to_dict("records")]