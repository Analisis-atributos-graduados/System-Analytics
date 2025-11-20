import logging
import os
from typing import List, Dict, Optional
import google.generativeai as genai

log = logging.getLogger(__name__)


class GeminiClient:
    """Cliente para interactuar con la API de Gemini para análisis de imágenes."""

    def __init__(self):
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            log.warning("GEMINI_API_KEY no configurada")

        genai.configure(api_key=api_key)

        # ✅ CORREGIDO: Sin el prefijo "models/"
        self.model = genai.GenerativeModel('gemini-flash-latest')
        log.info(f"GeminiClient inicializado con modelo {self.model.model_name}")

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
