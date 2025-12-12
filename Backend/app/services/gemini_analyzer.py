import logging
import os
import json
import base64
import io
from typing import Dict, List, Optional
from PIL import Image

# Librerías de Google
import google.generativeai as genai
from google.cloud import secretmanager

# Tus modelos
from app.models.rubrica import Rubrica

log = logging.getLogger(__name__)

class GeminiAnalyzer:

    def __init__(self):
        api_key = self._get_api_key_from_secret()
        
        if not api_key:
            log.critical("GeminiAnalyzer: API Key no encontrada en Secret Manager.")

            genai.configure(api_key="KEY_MISSING")
            self.is_ready = False
        else:
            genai.configure(api_key=api_key)
            self.is_ready = True

        self.model_name = "gemini-flash-latest" 
        self.model = genai.GenerativeModel(self.model_name)
        
        if self.is_ready:
            log.info(f"GeminiAnalyzer inicializado con modelo {self.model_name}")

    def _get_api_key_from_secret(self) -> Optional[str]:

        try:
            project_id = "511391059179"
            secret_id = "GEMINI_API_KEY"
            version_id = "latest"
            
            name = f"projects/{project_id}/secrets/{secret_id}/versions/{version_id}"
            
            client = secretmanager.SecretManagerServiceClient()
            response = client.access_secret_version(request={"name": name})

            return response.payload.data.decode("UTF-8").strip()

        except Exception as e:
            log.exception(f"GeminiAnalyzer: Error leyendo Secret Manager: {e}")
            return None

    def analyze_document(
        self,
        text: str,
        images_base64: List[str],
        rubrica: Rubrica,
        tema: str,
        descripcion_tema: str,
        tipo_documento: str
    ) -> Dict:

        if not self.is_ready:
            log.error("No se puede analizar: GeminiAnalyzer no tiene API Key válida.")
            return {}

        try:
            log.info(f"Iniciando análisis con Gemini. Tipo: {tipo_documento}, Texto: {len(text)} chars")

            system_prompt = self._build_system_prompt(rubrica, tema, descripcion_tema, tipo_documento)

            content_parts = [system_prompt]
            content_parts.append(f"\n\n--- DOCUMENTO A EVALUAR ---\n\n{text}\n")

            if tipo_documento != "EXAMEN_MANUSCRITO" and images_base64:
                log.info(f"Adjuntando {len(images_base64)} imágenes al análisis")
                image_parts = self._process_images(images_base64)
                if image_parts:
                    content_parts.extend(image_parts)

            response = self.model.generate_content(content_parts)

            return self._parse_response(response.text)

        except Exception as e:
            log.error(f"Error en GeminiAnalyzer.analyze_document: {e}")
            return {}

    def _build_system_prompt(self, rubrica: Rubrica, tema: str, descripcion_tema: str, tipo_documento: str) -> str:
        
        prompt = f"""
        Actúa como un Profesor Experto en Ingeniería de Sistemas, IA y Tecnología. Tu tarea es evaluar un trabajo académico de un estudiante.
        
        **Contexto de la Evaluación:**
        - Tipo de Documento: {tipo_documento}
        - Tema: {tema}
        - Descripción del Tema: {descripcion_tema}
        
        **Instrucciones de Evaluación (MODO ESTRICTO):**
        1. Analiza el documento completo de manera holística y CRÍTICA.
        2. Evalúa CADA criterio de la rúbrica proporcionada a continuación.
        3. **SEVERIDAD:** Sé extremadamente riguroso. No otorgues el puntaje máximo a menos que el trabajo sea verdaderamente excepcional.
        4. **JUSTIFICACIÓN:** En el feedback, justifica claramente por qué NO se alcanzó el nivel superior.
        
        **Rúbrica de Evaluación:**
        """
        
        for criterio in rubrica.criterios:
            prompt += f"\n- Criterio: {criterio.nombre_criterio} (Peso: {criterio.peso}%)\n"
            prompt += f"  Descripción: {criterio.descripcion_criterio}\n"
            prompt += "  Niveles:\n"
            for nivel in criterio.niveles:
                prompt += f"    * {nivel.nombre_nivel} (Puntaje Máx: {nivel.puntaje_max}): {', '.join(nivel.descriptores)}\n"

        prompt += """
        \n**Formato de Salida Requerido (JSON):**
        Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura exacta. No incluyas markdown.
        
        {
            "resultados": [
                {
                    "criterio": "Nombre exacto del criterio",
                    "nivel_asignado": "Nombre exacto del nivel",
                    "puntaje_obtenido": 15.5,
                    "feedback": "Explicación detallada.",
                    "confidence": 0.95
                }
            ],
            "comentarios_generales": "Resumen global."
        }
        """
        return prompt

    def _process_images(self, images_base64: List[str]):

        image_parts = []
        for img_b64 in images_base64:
            try:
                img_bytes = base64.b64decode(img_b64)
                img = Image.open(io.BytesIO(img_bytes))
                image_parts.append(img)
            except Exception as e:
                log.warning(f"Error procesando imagen para Gemini: {e}")
                continue
        return image_parts

    def _parse_response(self, response_text: str) -> Dict:

        try:
            text = response_text.strip()

            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text.replace("```", "")
            if text.endswith("```"):
                text = text[:-3]
            
            return json.loads(text.strip())
        except json.JSONDecodeError as e:
            log.error(f"Error parseando JSON de Gemini: {e}. Respuesta cruda: {response_text}")
            return {}