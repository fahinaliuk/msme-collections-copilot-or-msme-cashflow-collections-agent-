"""Application configuration loaded from environment variables.

Validates critical secrets at startup and provides production-safe defaults
for local development while requiring explicit configuration for production.
"""

import warnings
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration. Values loaded from environment or .env file."""

    # App
    APP_NAME: str = "MSME Collections Copilot"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development | staging | production

    # Database — PostgreSQL for production, SQLite for local dev
    DATABASE_URL: str = "sqlite+aiosqlite:///msme_agent.db"
    DATABASE_URL_SYNC: str = "sqlite:///msme_agent.db"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30

    # Auth / JWT — must be overridden in production
    SECRET_KEY: str = "insecure-dev-only-change-me"
    JWT_SECRET: str = "insecure-dev-only-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # OpenAI / LLM
    OPENAI_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_EXTRACTION_MODEL: str = "gpt-4o-mini"

    # Upload limits
    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024  # 10 MB
    MAX_EXTRACTION_CHARS: int = 12000

    # CORS — comma-separated in env var (e.g. http://localhost:3000,https://app.example.com)
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Logging
    LOG_LEVEL: str = "INFO"  # DEBUG | INFO | WARNING | ERROR

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @property
    def cors_origins(self) -> list[str]:
        """Parsed list of allowed browser origins for CORS middleware."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in ("production", "prod")

    @property
    def is_sqlite(self) -> bool:
        return "sqlite" in self.DATABASE_URL

    @property
    def db_pool_kwargs(self) -> dict:
        """Connection pool arguments safe for both SQLite and PostgreSQL."""
        if self.is_sqlite:
            return {"future": True}
        return {
            "future": True,
            "pool_size": self.DB_POOL_SIZE,
            "max_overflow": self.DB_MAX_OVERFLOW,
            "pool_timeout": self.DB_POOL_TIMEOUT,
            "pool_pre_ping": True,
        }


settings = Settings()


def validate_production_settings() -> list[str]:
    """Check critical settings and return a list of warnings/errors.

    Call this during application startup so misconfiguration is immediately visible.
    """
    issues: list[str] = []

    if settings.is_production:
        if "insecure-dev-only" in settings.SECRET_KEY:
            issues.append(
                "SECRET_KEY is still set to the insecure default. "
                "Generate a strong value: python3 -c 'import secrets; print(secrets.token_hex(32))'"
            )
        if "insecure-dev-only" in settings.JWT_SECRET:
            issues.append(
                "JWT_SECRET is still set to the insecure default. "
                "Generate a strong value: python3 -c 'import secrets; print(secrets.token_hex(32))'"
            )
        if settings.is_sqlite:
            issues.append(
                "DATABASE_URL points to SQLite in production mode. "
                "Set DATABASE_URL to a PostgreSQL connection string (e.g. postgresql+asyncpg://...)."
            )
        if not settings.CORS_ORIGINS or all(
            "localhost" in o or "127.0.0.1" in o for o in settings.cors_origins
        ):
            issues.append(
                "CORS_ORIGINS only contains localhost addresses. "
                "Add your production frontend URL(s)."
            )

    if not settings.OPENAI_API_KEY:
        warnings.warn(
            "OPENAI_API_KEY is not set. LLM-powered extraction and reminder "
            "polishing will be unavailable. Template fallbacks will be used.",
            stacklevel=2,
        )

    return issues