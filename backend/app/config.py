from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    redis_url: str = "redis://redis:6379/0"
    download_dir: str = "/app/downloads"
    file_ttl_seconds: int = 1800
    max_filesize_mb: int = 2048
    rate_limit_per_min: int = 5
    ytdlp_cookies: str = ""
    frontend_origin: str = "http://localhost:3000"


settings = Settings()
