import logging
import os
from typing import List, Dict, Optional
import google.generativeai as genai

log = logging.getLogger(__name__)


import logging
import os
from typing import List, Dict, Optional
import google.generativeai as genai
from google.cloud import secretmanager

log = logging.getLogger(__name__)


class GeminiClient:
    """Cliente para interactuar con la API de Gemini para análisis de imágenes."""

    def __init__(self):
        api_key = self._get_api_key()
        
        if not api_key:
            log.warning("GEMINI_API_KEY no configurada. El cliente de Gemini no funcionará.")
            # Configurar con clave vacía para evitar que la app se caiga al inicio
            genai.configure(api_key="DUMMY_KEY_FOR_INITIALIZATION")
        else:
            genai.configure(api_key=api_key)

        # ✅ CORREGIDO: Sin el prefijo "models/"
        self.model = genai.GenerativeModel('gemini-flash-latest')
        log.info(f"GeminiClient inicializado con modelo {self.model.model_name}")

    def _get_api_key(self) -> Optional[str]:
        """
        Obtiene la API key de Gemini de forma segura.
        1. Intenta desde Google Secret Manager.
        2. Si falla, intenta desde variables de entorno.
        """
        try:
            # Reemplaza con tu Project ID y Secret ID
            project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "evalia-475805")
            secret_id = "GEMINI_API_KEY"
            secret_name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"

            client = secretmanager.SecretManagerServiceClient()
            response = client.access_secret_version(request={"name": secret_name})
            
            key = response.payload.data.decode("UTF-8")
            log.info("✅ Clave de API de Gemini cargada desde Secret Manager.")
            return key
        except Exception as e:
            log.warning(f"No se pudo cargar la clave desde Secret Manager: {e}. Intentando desde variable de entorno...")
            
            # Fallback a variable de entorno
            api_key = os.environ.get("GEMINI_API_KEY")
            if api_key:
                log.info("✅ Clave de API de Gemini cargada desde variable de entorno.")
                return api_key
            
            log.error("❌ No se encontró la clave de API de Gemini ni en Secret Manager ni en variables de entorno.")
            return None

    def analyze_images(
            self,
            images_base64: List[str],
            tema: str,
            descripcion_tema: str
    ) -> Optional[Dict]:
        """
        Analiza imágenes con Gemini para evaluar calidad y contenido.
        """
        try:
            # Limitar a 10 imágenes para no exceder cuota
            images_to_analyze = images_base64[:10]

            log.info(f"Enviando {len(images_to_analyze)} imágenes a Gemini para análisis")

            prompt = f"""
            Analiza estas imágenes de un documento académico sobre "{tema}".

            Contexto: {descripcion_tema}

            Evalúa:
            1. Calidad de la imagen (claridad, legibilidad)
            2. Presencia de diagramas, gráficos o ecuaciones
            3. Calidad del contenido visual

            Responde SOLO en formato JSON válido:
            {{
                "calidad_promedio": 7.5,
                "tiene_diagramas": true,
                "tiene_ecuaciones": false,
                "observaciones": "Las imágenes muestran texto claro con algunos diagramas"
            }}
            """

            # Convertir base64 a formato que Gemini pueda usar
            import base64
            from PIL import Image
            import io

            image_parts = []
            for img_b64 in images_to_analyze:
                try:
                    img_bytes = base64.b64decode(img_b64)
                    img = Image.open(io.BytesIO(img_bytes))
                    image_parts.append(img)
                except Exception as e:
                    log.warning(f"Error procesando imagen: {e}")
                    continue

            if not image_parts:
                log.warning("No se pudieron procesar imágenes")
                return None

            # Enviar a Gemini
            response = self.model.generate_content([prompt] + image_parts)

            # Parsear respuesta JSON
            import json
            try:
                # Limpiar respuesta (a veces Gemini agrega markdown)
                text = response.text.strip()
                if text.startswith("```json") and text.endswith("```"):
                    text = text[len("```json"):-len("```")].strip()
                elif text.startswith("```") and text.endswith("```"):
                    text = text[len("```"):-len("```")].strip()

                result = json.loads(text)
                log.info(f"✅ Análisis visual completado: calidad={result.get('calidad_promedio', 0)}")
                return result
            except json.JSONDecodeError:
                log.warning(f"Respuesta de Gemini no es JSON válido: {response.text}")
                return {
                    "calidad_promedio": 5.0,
                    "tiene_diagramas": False,
                    "tiene_ecuaciones": False,
                    "observaciones": "Análisis parcial - respuesta no parseable"
                }

        except Exception as e:
            log.error(f"Error al analizar imágenes con Gemini: {e}")

            # Manejo específico de errores de cuota
            if "429" in str(e) or "quota" in str(e).lower():
                log.warning("⚠️ Cuota de Gemini excedida, continuando sin análisis visual")

            return None
