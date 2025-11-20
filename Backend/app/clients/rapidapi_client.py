import logging
import requests
from typing import Optional

from app.config.settings import settings

log = logging.getLogger(__name__)


class RapidAPIClient:
    """Cliente para llamar a Pen-to-Print OCR API via RapidAPI."""

    def __init__(self):
        self.api_key = settings.RAPIDAPI_KEY
        self.base_url = "https://pen-to-print-handwriting-ocr.p.rapidapi.com/recognize/"
        self.headers = {
            "x-rapidapi-key": self.api_key,
            "x-rapidapi-host": "pen-to-print-handwriting-ocr.p.rapidapi.com"
        }
        log.info("RapidAPIClient inicializado para Pen-to-Print OCR")

    def ocr_image(
            self,
            image_bytes: bytes,
            src: str = "image_file",
            session_id: str = "default_session"
    ) -> Optional[str]:
        """
        Realiza OCR sobre una imagen manuscrita.

        Args:
            image_bytes: Bytes de la imagen (PNG, JPG, etc.)
            src: Fuente de la imagen (siempre "image_file")
            session_id: ID de sesión (opcional)

        Returns:
            Texto extraído por OCR, o None si falla
        """
        try:
            # Preparar la petición
            querystring = {
                "src": src,
                "session_id": session_id
            }

            files = {
                "srcImg": ("page.png", image_bytes, "image/png")
            }

            log.info(f"Llamando a OCR API (session_id={session_id}, tamaño={len(image_bytes)} bytes)")

            # Hacer la petición
            response = requests.post(
                self.base_url,
                headers=self.headers,
                params=querystring,
                files=files,
                timeout=60  # 60 segundos de timeout
            )

            response.raise_for_status()

            # Parsear respuesta
            data = response.json()

            # Extraer texto (varía según la API)
            texto = data.get("value", "")

            if texto:
                log.info(f"OCR exitoso: {len(texto)} caracteres extraídos")
                return texto
            else:
                log.warning("OCR no devolvió texto")
                return None

        except requests.exceptions.Timeout:
            log.error("Timeout al llamar a OCR API")
            return None
        except requests.exceptions.HTTPError as e:
            log.error(f"Error HTTP al llamar a OCR API: {e}")
            log.error(f"Respuesta: {response.text if response else 'N/A'}")
            return None
        except Exception as e:
            log.error(f"Error inesperado al llamar a OCR API: {e}")
            return None

    def ocr_multiple_images(
            self,
            images_list: list,
            session_id: str = "default_session"
    ) -> list:
        """
        Realiza OCR sobre múltiples imágenes secuencialmente.

        Args:
            images_list: Lista de bytes de imágenes
            session_id: ID de sesión compartido

        Returns:
            Lista de textos extraídos (None si alguno falla)
        """
        results = []

        for i, img_bytes in enumerate(images_list):
            log.info(f"Procesando imagen {i + 1}/{len(images_list)}")
            texto = self.ocr_image(img_bytes, session_id=f"{session_id}_page_{i}")
            results.append(texto)

        successful = sum(1 for r in results if r is not None)
        log.info(f"OCR completado: {successful}/{len(images_list)} imágenes procesadas exitosamente")

        return results
