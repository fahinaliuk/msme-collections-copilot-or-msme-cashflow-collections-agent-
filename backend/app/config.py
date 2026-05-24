"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration. Values loaded from .env file or environment."""

    # App
    APP_NAME: str = "MSME Collections Copilot"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///msme_agent.db"
    DATABASE_URL_SYNC: str = "sqlite:///msme_agent.db"

    # Auth / JWT
    SECRET_KEY: str = "change-me-to-a-real-secret-in-production"
    JWT_SECRET: str = "change-me-to-a-real-jwt-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # OpenAI / LLM
    OPENAI_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_EXTRACTION_MODEL: str = "gpt-4o-mini"

    # Upload limits
    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024  # 10 MB
    MAX_EXTRACTION_CHARS: int = 12000

    # CORS — comma-separated in .env (e.g. http://localhost:3000,http://127.0.0.1:3000)
    CORS_ORIGINS: str = (
        "http://localhost:3000,"
        "http://localhost:8000,"
        "http://127.0.0.1:3000,"
        "http://127.0.0.1:8000"
    )

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",  # allow Docker-only vars (POSTGRES_*, etc.) in same .env
    }

    @property
    def cors_origins(self) -> list[str]:
        """Parsed list of allowed browser origins for CORS middleware."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()