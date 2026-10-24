from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Placeholder — migrate/app refuse CHANGE_ME. Set real URL in backend/.env.
    database_url: str = "postgresql://USER:CHANGE_ME@127.0.0.1:5432/yoyknowmail"
    frontend_origins: str = "http://localhost:3000"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    session_ttl_hours: int = 168
    temp_token_ttl_minutes: int = 10
    app_env: str = "development"
    mail_domain: str = "yoyknowmail.com"
    bulk_mailbox_limit: int = 100
    login_rate_limit_per_minute: int = 10
    totp_encryption_key: str = ""
    session_cookie_name: str = "ykm_session"
    csrf_cookie_name: str = "ykm_csrf"
    csrf_header_name: str = "X-CSRF-Token"

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
