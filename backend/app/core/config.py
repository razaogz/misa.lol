from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        extra="ignore",
        case_sensitive=False,
        env_prefix="MISA_",
        populate_by_name=True,
    )

    app_name: str = "misa"
    app_version: str = "0.1.0"
    environment: str = "production"
    debug: bool = False
    instance_name: str = "api"
    api_v1_prefix: str = "/api/v1"
    domain: str = "misa.lol"
    public_base_url: str = "https://misa.lol"
    database_url: str = Field(default="", validation_alias=AliasChoices("DATABASE_URL", "MISA_DATABASE_URL"))

    data_api_url: str = Field(
        default="http://prostgres_db:8080",
        validation_alias=AliasChoices("DATA_API_URL", "MISA_DATA_API_URL"),
    )
    data_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("DATA_API_KEY", "MISA_DATA_API_KEY"),
    )
    dragonfly_url: str = Field(
        default="redis://dragonfly:6379/0",
        validation_alias=AliasChoices("DRAGONFLY_URL", "MISA_DRAGONFLY_URL"),
    )

    cors_origins: str = "http://localhost,http://localhost:80,https://misa.lol,https://www.misa.lol"

    session_cookie_name: str = "misa_session"
    session_ttl_seconds: int = 60 * 60 * 24 * 7
    session_remember_ttl_seconds: int = 60 * 60 * 24 * 30

    google_client_id: str = ""
    google_client_secret: str = ""
    discord_client_id: str = ""
    discord_client_secret: str = ""
    telegram_bot_token: str = ""
    telegram_bot_username: str = ""
    turnstile_site_key: str = ""
    turnstile_secret_key: str = ""
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    storage_bucket: str = "misa-assets"
    admin_user_ids: str = ""
    admin_root_email: str = Field(default="", validation_alias=AliasChoices("SUPER_ADMIN_EMAIL"))
    admin_token_secret: str = ""
    email_api_url: str = ""
    email_api_key: str = ""
    email_from: str = "Misa.lol <no-reply@misa.lol>"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def google_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def discord_enabled(self) -> bool:
        return bool(self.discord_client_id and self.discord_client_secret)

    @property
    def telegram_enabled(self) -> bool:
        return bool(self.telegram_bot_token and self.telegram_bot_username)

    @property
    def telegram_bot_id(self) -> str:
        return self.telegram_bot_token.split(":", 1)[0] if self.telegram_bot_token else ""

    @property
    def admin_user_id_list(self) -> set[str]:
        return {value.strip() for value in self.admin_user_ids.split(",") if value.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
