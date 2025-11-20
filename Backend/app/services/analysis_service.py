import logging
from typing import Dict, List
import json

from app.ml import DeBertaAnalyzer
from app.clients import GeminiClient
from app.models.resultado_analisis import ResultadoAnalisis
from app.repositories import (
    ArchivoRepository,
    ResultadoRepository,
    RubricaRepository,
    EvaluacionRepository  # Asegúrate de importar esto
)
# Asumo que tienes un ScoringService, si no, la lógica de niveles se puede hacer inline,
# pero es mejor tenerlo inyectado si ya existe.
from app.services.scoring_service import ScoringService

log = logging.getLogger(__name__)


class AnalysisService:
    """Coordina el análisis de documentos con DeBERTa y Gemini."""

    def __init__(
            self,
            deberta_analyzer: DeBertaAnalyzer,
            gemini_client: GeminiClient,
            archivo_repo: ArchivoRepository,
            resultado_repo: ResultadoRepository,
            rubrica_repo: RubricaRepository,
            evaluacion_repo: EvaluacionRepository,
            scoring_service: ScoringService
    ):
        self.deberta_analyzer = deberta_analyzer  # Ojo: en tu código usabas self.analyzer y self.deberta_analyzer indistintamente
        self.analyzer = deberta_analyzer  # Alias para compatibilidad
        self.gemini_client = gemini_client
        self.archivo_repo = archivo_repo
        self.resultado_repo = resultado_repo
        self.rubrica_repo = rubrica_repo
        self.evaluacion_repository = evaluacion_repo
        self.scoring_service = scoring_service

    async def analyze_evaluation(self, evaluacion_id: int):
        log.info(f"Analizando evaluación {evaluacion_id}...")

        # 1. Obtener evaluación y archivo procesado
        evaluacion = self.evaluacion_repository.get_by_id(evaluacion_id)

        if not evaluacion:
            log.error(f"No se encontró evaluación con ID {evaluacion_id}")
            return

        if not evaluacion.archivos_procesados:
            log.error(f"La evaluación {evaluacion_id} no tiene archivos procesados.")
            return

        archivo = evaluacion.archivos_procesados[0]

        # 2. Recuperar el análisis visual de Gemini (si existe)
        analisis_visual_data = {}
        if archivo.analisis_visual:
            try:
                if isinstance(archivo.analisis_visual, str):
                    analisis_visual_data = json.loads(archivo.analisis_visual)
                else:
                    analisis_visual_data = archivo.analisis_visual
            except Exception as e:
                log.error(f"Error al parsear JSON de análisis visual: {e}")

        # 3. Iterar por criterios de la rúbrica
        resultados_criterios = {}

        # Asegurarse de que la rúbrica y sus criterios estén cargados
        if not evaluacion.rubrica or not evaluacion.rubrica.criterios:
            # Fallback si no vinieran cargados por eager loading (depende de tu repo)
            rubrica = self.rubrica_repo.get_with_criterios(evaluacion.rubrica_id)
            criterios = rubrica.criterios
        else:
            criterios = evaluacion.rubrica.criterios

        for criterio in criterios:
            # A. Análisis de Texto (DeBERTa)
            # self.analyzer llama a DeBertaAnalyzer.analyze_text
            resultado_texto = self.analyzer.analyze_text(
                text=archivo.texto_extraido,
                criterio=criterio.nombre_criterio,
                tema=evaluacion.tema,
                descripcion_tema=evaluacion.descripcion_tema or "",  # Manejo de None
                niveles=[n.__dict__ for n in criterio.niveles]  # Pasar niveles como dict
            )

            # B. Integrar Análisis Visual (Gemini)
            score_visual = 0.0
            feedback_visual = ""
            peso_visual = 0.0

            if analisis_visual_data:
                # Intentamos sacar un score general si Gemini lo devolvió, sino 0.5 (neutro)
                score_visual = float(analisis_visual_data.get("score_general", 0.5))
                feedback_visual = analisis_visual_data.get("comentarios", "")

                # Lógica de Ponderación basada en palabras clave del criterio
                keywords_visuales = ["diagrama", "esquema", "grafico", "imagen", "prototipo", "diseño", "visual"]
                if any(k in criterio.nombre_criterio.lower() for k in keywords_visuales):
                    peso_visual = 0.4  # 40% Imagen, 60% Texto
                    log.info(f"Criterio '{criterio.nombre_criterio}' detectado como VISUAL. Peso imagen: {peso_visual}")
                else:
                    peso_visual = 0.1  # 10% Imagen (calidad general), 90% Texto

            # C. Fusión de Notas (Texto + Imagen)
            score_texto = resultado_texto.get("score", 0.0)

            if peso_visual > 0:
                score_final_criterio = (score_texto * (1 - peso_visual)) + (score_visual * peso_visual)
                # Añadimos feedback visual solo si es relevante
                extra_feedback = f" [Visual: {feedback_visual[:50]}...]" if feedback_visual else ""
                feedback_final = f"{resultado_texto.get('feedback', '')}{extra_feedback}"
            else:
                score_final_criterio = score_texto
                feedback_final = resultado_texto.get('feedback', '')

            # Asegurar rango 0-1
            score_final_criterio = max(0.0, min(1.0, score_final_criterio))

            # D. Determinar Nivel final basado en el score fusionado
            nivel_final_obj = self.scoring_service.get_level_from_score(
                score_final_criterio,
                criterio.niveles
            )

            # Guardamos el resultado estructurado
            resultados_criterios[str(criterio.id)] = {
                "puntaje": score_final_criterio,  # 0-1
                "nivel": nivel_final_obj.nombre_nivel if nivel_final_obj else "Desconocido",
                "feedback": feedback_final
            }

        # 4. Calcular Nota Final Global (Ponderada por pesos de criterios)
        scores_map = {k: v["puntaje"] for k, v in resultados_criterios.items()}

        # Crear mapa de pesos {id_criterio_str: peso_float}
        weights_map = {str(c.id): c.peso for c in criterios}

        nota_final_0_1 = self.scoring_service.calculate_weighted_score(scores_map, weights_map)

        # 5. Guardar Resultado en BD
        resultado_obj = ResultadoAnalisis(
            evaluacion_id=evaluacion_id,
            criterios_evaluados=resultados_criterios,
            nota_final=nota_final_0_1,
            feedback_general=f"Evaluación completada. Nota calculada sobre {len(resultados_criterios)} criterios."
        )

        self.resultado_repository.create(resultado_obj)
        log.info(f"Evaluación {evaluacion_id} finalizada con nota global: {nota_final_0_1:.3f}")
