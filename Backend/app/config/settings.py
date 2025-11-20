import os
import logging

log = logging.getLogger(__name__)


class Settings:
    """Configuración centralizada del sistema."""

    # Google Cloud
    GCP_PROJECT_ID: str = os.environ.get("GCP_PROJECT_ID")
    GCP_LOCATION: str = os.environ.get("GCP_LOCATION")
    BUCKET_NAME: str = os.environ.get("GCS_BUCKET_NAME")
    QUEUE_NAME: str = os.environ.get("GCS_QUEUE_NAME")
    SERVICE_ACCOUNT_EMAIL: str = os.environ.get("SERVICE_ACCOUNT_EMAIL")

    # Service URL
    SERVICE_URL: str = os.environ.get(
        "SERVICE_URL",
        "https://analitica-backend-511391059179.southamerica-east1.run.app"
    )

    # API Keys
    RAPIDAPI_KEY: str = os.environ.get("RAPIDAPI_KEY")

    # Database
    DATABASE_URL: str = os.environ.get("DATABASE_URL")

    # ML Model
    MODEL_PATH: str = "/app/model"

    def __init__(self):
        log.info(f"GCP_PROJECT_ID: {self.GCP_PROJECT_ID}")
        log.info(f"GCP_LOCATION: {self.GCP_LOCATION}")
        log.info(f"BUCKET_NAME: {self.BUCKET_NAME}")
        log.info(f"QUEUE_NAME: {self.QUEUE_NAME}")
        log.info(f"SERVICE_URL: {self.SERVICE_URL}")


settings = Settings()
