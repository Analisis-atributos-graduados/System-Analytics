import logging
import os
from typing import List, Dict, Optional
import google.generativeai as genai
from google.cloud import secretmanager
import json
import base64
from PIL import Image
import io

log = logging.getLogger(__name__)


class GeminiClient:

    def __init__(self):

        api_key = self._get_api_key_from_secret()

        if not api_key:
            log.critical("ERROR CRÍTICO: No se pudo cargar la API KEY. El servicio fallará.")

            genai.configure(api_key="INVALID_KEY_BECAUSE_SECRET_FAILED")
            self.is_ready = False
        else:
            genai.configure(api_key=api_key)
            self.is_ready = True

        self.model = genai.GenerativeModel('gemini-flash-latest')

    def _get_api_key_from_secret(self) -> Optional[str]:

        try:
            project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
            if not project_id:
                project_id = "evalia-475805"

            secret_id = "GEMINI_API_KEY"
            version_id = "latest"

            secret_name = f"projects/{project_id}/secrets/{secret_id}/versions/{version_id}"

            log.info(f"Intentando leer secreto: {secret_name}")

            client = secretmanager.SecretManagerServiceClient()
            response = client.access_secret_version(request={"name": secret_name})

            payload = response.payload.data.decode("UTF-8").strip()

            if payload:
                log.info("Secreto leído correctamente (longitud: %d)", len(payload))
                return payload
            else:
                log.error("El secreto se leyó pero está VACÍO.")
                return None

        except Exception as e:

            log.exception(f"EXCEPCIÓN AL LEER SECRET MANAGER: {str(e)}")
            return None

    def analyze_images(self, images_base64: List[str], tema: str, descripcion_tema: str) -> Optional[Dict]:

        if not self.is_ready:
            log.error("Intento de análisis bloqueado: El cliente no se inicializó correctamente (Falta Key).")
            return None

        try:
            images_to_analyze = images_base64[:10]
            log.info(f"Enviando {len(images_to_analyze)} imágenes a Gemini...")

            prompt = f"""
            Analiza estas imágenes de un documento académico sobre "{tema}".
            Contexto: {descripcion_tema}
            Devuelve un JSON válido con: calidad_promedio (float), tiene_diagramas (bool), observaciones (str).
            """

            image_parts = []
            for img_b64 in images_to_analyze:
                try:
                    img_bytes = base64.b64decode(img_b64)
                    img = Image.open(io.BytesIO(img_bytes))
                    image_parts.append(img)
                except Exception as e:
                    continue

            if not image_parts:
                return None

            response = self.model.generate_content([prompt] + image_parts)

            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:-3]
            elif text.startswith("```"):
                text = text[3:-3]

            return json.loads(text.strip())

        except Exception as e:
            log.error(f"Error en llamada a Gemini: {e}")
            return None