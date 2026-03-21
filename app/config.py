import os
from pathlib import Path


def _require_env(name: str) -> str:
    """Raise RuntimeError if a required env var is missing. Used in ProductionConfig."""
    raise RuntimeError(f"Required environment variable {name} is not set")


class BaseConfig:
    """Base configuration shared across all environments."""

    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    APP_DIR: Path = Path(__file__).resolve().parent

    # Flask
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    MAX_CONTENT_LENGTH: int = 10 * 1024 * 1024  # 10MB upload limit

    # Supabase
    SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.environ.get("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    # Redis
    REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379")

    # Redis DB assignments
    REDIS_DB_CACHE: int = 0
    REDIS_DB_RATE_LIMIT: int = 1
    REDIS_DB_SESSIONS: int = 2
    REDIS_DB_CELERY: int = 3
    REDIS_DB_PUBSUB: int = 4

    # Celery
    @property
    def CELERY_BROKER_URL(self) -> str:
        return f"{self.REDIS_URL}/{self.REDIS_DB_CELERY}"

    @property
    def CELERY_RESULT_BACKEND(self) -> str:
        return f"{self.REDIS_URL}/{self.REDIS_DB_CELERY}"

    CELERY_TASK_SERIALIZER: str = "json"
    CELERY_RESULT_SERIALIZER: str = "json"
    CELERY_ACCEPT_CONTENT: list[str] = ["json"]
    CELERY_TIMEZONE: str = "UTC"

    # Valor PayTech
    VALOR_API_KEY: str = os.environ.get("VALOR_API_KEY", "")
    VALOR_APP_ID: str = os.environ.get("VALOR_APP_ID", "")
    VALOR_BASE_URL: str = os.environ.get("VALOR_BASE_URL", "https://api.valorpaytech.com")
    VALOR_MQTT_BROKER: str = os.environ.get("VALOR_MQTT_BROKER", "")

    # Twilio
    TWILIO_ACCOUNT_SID: str = os.environ.get("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.environ.get("TWILIO_AUTH_TOKEN", "")
    TWILIO_PHONE_NUMBER: str = os.environ.get("TWILIO_PHONE_NUMBER", "")

    # SendGrid
    SENDGRID_API_KEY: str = os.environ.get("SENDGRID_API_KEY", "")
    SENDGRID_FROM_EMAIL: str = os.environ.get("SENDGRID_FROM_EMAIL", "noreply@getsear.com")

    # JWT
    JWT_SECRET_KEY: str = os.environ.get("JWT_SECRET_KEY", "dev-jwt-secret-change-me")
    JWT_EXPIRY_HOURS: int = int(os.environ.get("JWT_EXPIRY_HOURS", "8"))

    # Rate limiting
    RATELIMIT_DEFAULT: str = "200/minute;5000/hour"
    RATELIMIT_STORAGE_URI: str = ""  # Set in init from REDIS_URL

    # GCP
    GCP_PROJECT_ID: str = os.environ.get("GCP_PROJECT_ID", "getsear-pos")
    GCP_REGION: str = os.environ.get("GCP_REGION", "us-central1")

    # CSRF
    WTF_CSRF_ENABLED: bool = True
    WTF_CSRF_TIME_LIMIT: int = 3600  # 1 hour

    # Session
    SESSION_COOKIE_HTTPONLY: bool = True
    SESSION_COOKIE_SAMESITE: str = "Lax"

    @property
    def RATELIMIT_STORAGE_OPTIONS(self) -> dict:
        return {"connection_url": f"{self.REDIS_URL}/{self.REDIS_DB_RATE_LIMIT}"}


class DevelopmentConfig(BaseConfig):
    """Development environment configuration."""

    DEBUG: bool = True
    TESTING: bool = False
    SESSION_COOKIE_SECURE: bool = False
    WTF_CSRF_ENABLED: bool = False  # Disable CSRF in dev for easier API testing
    RATELIMIT_ENABLED: bool = False


class StagingConfig(BaseConfig):
    """Staging environment configuration."""

    DEBUG: bool = False
    TESTING: bool = False
    SESSION_COOKIE_SECURE: bool = True
    RATELIMIT_ENABLED: bool = True


class ProductionConfig(BaseConfig):
    """Production environment configuration."""

    DEBUG: bool = False
    TESTING: bool = False
    SESSION_COOKIE_SECURE: bool = True
    RATELIMIT_ENABLED: bool = True
    PREFERRED_URL_SCHEME: str = "https"

    def __init__(self) -> None:
        super().__init__()
        self.SECRET_KEY = os.environ.get("SECRET_KEY") or _require_env("SECRET_KEY")
        self.JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or _require_env("JWT_SECRET_KEY")


class TestingConfig(BaseConfig):
    """Testing environment configuration."""

    DEBUG: bool = True
    TESTING: bool = True
    SESSION_COOKIE_SECURE: bool = False
    WTF_CSRF_ENABLED: bool = False
    RATELIMIT_ENABLED: bool = False
    # Use a separate Redis DB for testing
    REDIS_DB_CACHE: int = 10
    REDIS_DB_RATE_LIMIT: int = 11
    REDIS_DB_SESSIONS: int = 12
    REDIS_DB_CELERY: int = 13
    REDIS_DB_PUBSUB: int = 14


config_map: dict[str, type[BaseConfig]] = {
    "development": DevelopmentConfig,
    "staging": StagingConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}


def get_config(env_name: str | None = None) -> BaseConfig:
    """Return the config class for the given environment name."""
    env = env_name or os.environ.get("FLASK_ENV", "development")
    config_class = config_map.get(env, DevelopmentConfig)
    return config_class()
