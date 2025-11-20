import logging
import datetime
import hmac
import hashlib
import urllib.parse
from typing import Optional
from google.cloud import storage
import google.auth
import google.auth.transport.requests

from app.config.settings import settings

log = logging.getLogger(__name__)


class GCSClient:
    """Cliente para interactuar con Google Cloud Storage."""

    def __init__(self):
        self.bucket_name = settings.BUCKET_NAME
        self.storage_client = storage.Client()
        self.bucket = self.storage_client.bucket(self.bucket_name)
        log.info(f"GCSClient inicializado con bucket: {self.bucket_name}")

    def generate_signed_upload_url(
            self,
            filename: str,
            content_type: str = "application/pdf",
            expiration_minutes: int = 15
    ) -> dict:
        """
        Genera una URL firmada v4 para que el cliente suba directamente a GCS.

        Returns:
            dict con 'upload_url' y 'gcs_filename'
        """
        try:
            blob = self.bucket.blob(filename)

            # Generar URL firmada v4 para PUT
            url = blob.generate_signed_url(
                version="v4",
                expiration=datetime.timedelta(minutes=expiration_minutes),
                method="PUT",
                content_type=content_type
            )

            log.info(f"URL firmada generada para: {filename}")
            return {
                "upload_url": url,
                "gcs_filename": filename
            }
        except Exception as e:
            log.error(f"Error al generar URL firmada para {filename}: {e}")
            raise

    def generate_signed_download_url(
            self,
            filename: str,
            expiration_minutes: int = 60
    ) -> str:
        """
        Genera una URL firmada para descargar un archivo de GCS.
        """
        try:
            blob = self.bucket.blob(filename)

            url = blob.generate_signed_url(
                version="v4",
                expiration=datetime.timedelta(minutes=expiration_minutes),
                method="GET"
            )

            log.info(f"URL de descarga generada para: {filename}")
            return url
        except Exception as e:
            log.error(f"Error al generar URL de descarga para {filename}: {e}")
            raise

    def upload_blob(
            self,
            source_bytes: bytes,
            destination_blob_name: str,
            content_type: str = "application/pdf"
    ) -> str:
        """
        Sube bytes directamente a GCS desde el servidor.

        Returns:
            URL pública del archivo subido
        """
        try:
            blob = self.bucket.blob(destination_blob_name)
            blob.upload_from_string(source_bytes, content_type=content_type)

            log.info(f"Archivo subido a GCS: {destination_blob_name}")
            return f"gs://{self.bucket_name}/{destination_blob_name}"
        except Exception as e:
            log.error(f"Error al subir archivo {destination_blob_name}: {e}")
            raise

    def download_blob(self, source_blob_name: str) -> bytes:
        """
        Descarga un archivo de GCS como bytes.
        """
        try:
            blob = self.bucket.blob(source_blob_name)
            content = blob.download_as_bytes()

            log.info(f"Archivo descargado de GCS: {source_blob_name} ({len(content)} bytes)")
            return content
        except Exception as e:
            log.error(f"Error al descargar archivo {source_blob_name}: {e}")
            raise

    def blob_exists(self, blob_name: str) -> bool:
        """Verifica si un blob existe en GCS."""
        try:
            blob = self.bucket.blob(blob_name)
            return blob.exists()
        except Exception as e:
            log.error(f"Error al verificar existencia de {blob_name}: {e}")
            return False

    def delete_blob(self, blob_name: str) -> bool:
        """Elimina un blob de GCS."""
        try:
            blob = self.bucket.blob(blob_name)
            blob.delete()
            log.info(f"Archivo eliminado de GCS: {blob_name}")
            return True
        except Exception as e:
            log.error(f"Error al eliminar archivo {blob_name}: {e}")
            return False

    def list_blobs(self, prefix: str = None) -> list:
        """Lista todos los blobs con un prefijo opcional."""
        try:
            blobs = self.storage_client.list_blobs(self.bucket_name, prefix=prefix)
            blob_names = [blob.name for blob in blobs]
            log.info(f"Listados {len(blob_names)} blobs con prefijo '{prefix}'")
            return blob_names
        except Exception as e:
            log.error(f"Error al listar blobs: {e}")
            raise
