from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_VALID_SAMESITE = {"lax", "strict", "none"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database — the async psycopg driver. A bare ``postgresql://`` (as set by
    # docker-compose) is rewritten to ``postgresql+psycopg://`` so the same value
    # works for the async engine.
    database_url: str = (
        "postgresql+psycopg://postgres:password@localhost:5432/subscription_tracker"
    )

    # OIDC / Authentik. Empty defaults keep the app importable in CI/dev before an
    # identity provider is configured; real values come from the environment / .env.
    oidc_discovery_url: str = ""
    oidc_client_id: str = ""
    oidc_client_secret: str = ""
    oidc_redirect_uri: str = "http://localhost:8000/auth/callback"
    oidc_scopes: str = "openid profile email"
    oidc_post_logout_redirect_uri: str = "http://localhost:3000/"

    # Frontend redirect targets.
    frontend_url: str = "http://localhost:3000"
    frontend_post_login_url: str = "http://localhost:3000/"

    # App session cookie (issued by this BFF — NOT the Authlib flow cookie).
    session_cookie_name: str = "hm_session"
    session_cookie_domain: str | None = None
    session_cookie_secure: bool = False
    session_cookie_samesite: str = "lax"
    session_max_age_seconds: int = 60 * 60 * 24 * 7  # 7 days
    # Signs Starlette's transient OIDC flow cookie (PKCE verifier / state / nonce).
    session_secret: str = "dev-only-insecure-session-secret-change-me"

    # CORS — must list explicit origins (not "*") because credentials are allowed.
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("database_url")
    @classmethod
    def _use_async_driver(cls, value: str) -> str:
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @field_validator("session_cookie_samesite")
    @classmethod
    def _validate_samesite(cls, value: str) -> str:
        normalized = value.lower()
        if normalized not in _VALID_SAMESITE:
            raise ValueError(
                f"session_cookie_samesite must be one of {_VALID_SAMESITE}"
            )
        return normalized


@lru_cache
def get_settings() -> Settings:
    return Settings()


SettingsDep = Annotated[Settings, Depends(get_settings)]
