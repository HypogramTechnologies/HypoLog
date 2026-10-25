from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


def _resolve(path: Path) -> Path:
    """Caminho absoluto, independente de onde o comando foi executado."""
    return path if path.is_absolute() else BASE_DIR / path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    app_name: str = "HypoLog API"
    api_prefix: str = "/api/v1"
    deliveries_path: Path = Path("data/processed/deliveries.parquet")
    cities_path: Path = Path("data/processed/cities.parquet")
    cors_origins: list[str] = ["http://localhost:5173"]

    @property
    def deliveries_file(self) -> Path:
        return _resolve(self.deliveries_path)

    @property
    def cities_file(self) -> Path:
        return _resolve(self.cities_path)


settings = Settings()