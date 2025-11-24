import logging
import os
import json
from typing import Dict, List, Optional
import google.generativeai as genai
from app.models.rubrica import Rubrica

log = logging.getLogger(__name__)

class GeminiAnalyzer:
    """
    Analizador unificado usando Gemini 1.5 Pro.
    Evalúa documentos completos (texto + imágenes) o solo texto (exámenes manuscritos).
    """

    def __init__(self):
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            log.warning("GEMINI_API_KEY no configurada")
        
        genai.configure(api_key=api_key)
        
        # Usamos Gemini Flash Latest (nombre verificado en GeminiClient)
        self.model_name = "gemini-flash-latest" 
        self.model = genai.GenerativeModel(self.model_name)
        
        log.info(f"GeminiAnalyzer inicializado con modelo {self.model_name}")

    def analyze_document(
        self,
        text: str,
        images_base64: List[str],
        rubrica: Rubrica,
        tema: str,
        descripcion_tema: str,
        tipo_documento: str
    ) -> Dict:
        """
        Realiza el análisis completo del documento.
        
        Args:
            text: Texto completo del documento (o transcripción).
            images_base64: Lista de imágenes en base64 (gráficos, diagramas).
            rubrica: Objeto Rúbrica con criterios y niveles.
            tema: Tema del documento.
            descripcion_tema: Descripción del tema.
            tipo_documento: 'EXAMEN_MANUSCRITO' o 'INFORME'/'ENSAYO'.
            
        Returns:
            Dict con los resultados de la evaluación por criterio.
        """
        try:
            log.info(f"Iniciando análisis con Gemini. Tipo: {tipo_documento}, Texto: {len(text)} chars, Imágenes: {len(images_base64)}")

            # 1. Preparar el Prompt del Sistema (Rúbrica y Contexto)
            system_prompt = self._build_system_prompt(rubrica, tema, descripcion_tema, tipo_documento)
            
            # 2. Preparar el contenido para Gemini
            content_parts = [system_prompt]
            
            # Agregar texto del documento
            content_parts.append(f"\n\n--- DOCUMENTO A EVALUAR ---\n\n{text}\n")
            
            # Agregar imágenes (solo si NO es examen manuscrito, según requerimiento)
            if tipo_documento != "EXAMEN_MANUSCRITO" and images_base64:
                log.info(f"Adjuntando {len(images_base64)} imágenes al análisis")
                image_parts = self._process_images(images_base64)
                content_parts.extend(image_parts)
            elif tipo_documento == "EXAMEN_MANUSCRITO":
                log.info("Examen manuscrito: Se omite el envío de imágenes (solo transcripción).")

            # 3. Llamar a Gemini
            response = self.model.generate_content(content_parts)
            
            # 4. Parsear respuesta
            return self._parse_response(response.text)

        except Exception as e:
            log.error(f"Error en GeminiAnalyzer.analyze_document: {e}")
            # Retornar estructura de error o vacía para no romper el flujo
            return {}

    def _build_system_prompt(self, rubrica: Rubrica, tema: str, descripcion_tema: str, tipo_documento: str) -> str:
        """Construye el prompt maestro con la rúbrica y las instrucciones."""
        
        prompt = f"""
        Actúa como un Profesor Experto en Ingeniería de Sistemas, IA y Tecnología. Tu tarea es evaluar un trabajo académico de un estudiante.
        
        **Contexto de la Evaluación:**
        - Tipo de Documento: {tipo_documento}
        - Tema: {tema}
        - Descripción del Tema: {descripcion_tema}
        
        **Instrucciones de Evaluación (MODO ESTRICTO):**
        1. Analiza el documento completo de manera holística y CRÍTICA.
        2. Evalúa CADA criterio de la rúbrica proporcionada a continuación.
        3. **SEVERIDAD:** Sé extremadamente riguroso. No otorgues el puntaje máximo a menos que el trabajo sea verdaderamente excepcional y cumpla con TODOS los descriptores del nivel más alto sin fallas.
        4. **PENALIZACIÓN:** Penaliza fuertemente las generalidades, la falta de profundidad técnica, el "relleno" y las afirmaciones sin sustento.
        5. **JUSTIFICACIÓN:** En el feedback, justifica claramente por qué NO se alcanzó el nivel superior. Sé específico sobre qué faltó.
        6. Si hay diagramas o imágenes, evalúa si son pertinentes y están bien explicados.
        7. Si el tema requiere conocimientos técnicos específicos, verifica que se usen correctamente.
        
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
        Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura exacta. No incluyas markdown (```json) ni texto adicional.
        
        {
            "resultados": [
                {
                    "criterio": "Nombre exacto del criterio",
                    "nivel_asignado": "Nombre exacto del nivel",
                    "puntaje_obtenido": 15.5, // Número (puede ser decimal)
                    "feedback": "Explicación detallada de por qué se asignó este nivel. Menciona fortalezas y debilidades específicas encontradas en el texto o imágenes.",
                    "confidence": 0.95 // Tu nivel de confianza en esta evaluación (0.0 a 1.0)
                },
                ... (repetir para todos los criterios)
            ],
            "comentarios_generales": "Un resumen global del desempeño del estudiante."
        }
        """
        
        return prompt

    def _process_images(self, images_base64: List[str]):
        """Convierte base64 a objetos de imagen compatibles con Gemini."""
        import base64
        from PIL import Image
        import io

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
        """Limpia y parsea la respuesta JSON de Gemini."""
        try:
            # Limpiar bloques de código markdown si existen
            text = response_text.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.endswith("```"):
                text = text[:-3]
            
            return json.loads(text.strip())
        except json.JSONDecodeError as e:
            log.error(f"Error parseando JSON de Gemini: {e}. Respuesta cruda: {response_text}")
            return {}
