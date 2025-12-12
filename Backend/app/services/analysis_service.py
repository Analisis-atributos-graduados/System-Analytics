import logging
from typing import Dict, List, Optional
import json

from app.services.gemini_analyzer import GeminiAnalyzer
from app.models.resultado_analisis import ResultadoAnalisis
from app.repositories import (
    ArchivoRepository,
    ResultadoRepository,
    RubricaRepository,
    EvaluacionRepository
)

log = logging.getLogger(__name__)

class AnalysisService:

    def __init__(
            self,
            evaluacion_repo: EvaluacionRepository,
            archivo_repo: ArchivoRepository,
            rubrica_repo: RubricaRepository,
            resultado_repo: ResultadoRepository,
            gemini_analyzer: GeminiAnalyzer
    ):
        self.evaluacion_repo = evaluacion_repo
        self.archivo_repo = archivo_repo
        self.rubrica_repo = rubrica_repo
        self.resultado_repo = resultado_repo
        self.analyzer = gemini_analyzer

    def analyze_evaluation(self, evaluacion_id: int):

        try:
            log.info(f"Iniciando análisis para evaluación {evaluacion_id}")

            evaluacion = self.evaluacion_repo.get_by_id(evaluacion_id)
            if not evaluacion:
                raise ValueError(f"Evaluación {evaluacion_id} no encontrada")

            rubrica = self.rubrica_repo.get_by_id(evaluacion.rubrica_id)
            if not rubrica:
                raise ValueError("Rúbrica no encontrada")

            archivos = self.archivo_repo.get_by_evaluacion(evaluacion_id)
            if not archivos:
                raise ValueError("No hay archivos para analizar")

            full_text = ""
            
            for archivo in archivos:
                if archivo.texto_extraido:
                    full_text += f"\n--- Archivo: {archivo.nombre_archivo_original} ---\n"
                    full_text += archivo.texto_extraido

            resultados_gemini = self.analyzer.analyze_document(
                text=full_text,
                images_base64=[], 
                rubrica=rubrica,
                tema=evaluacion.tema,
                descripcion_tema=evaluacion.descripcion_tema,
                tipo_documento=evaluacion.tipo_documento
            )

            if not resultados_gemini or "resultados" not in resultados_gemini:
                log.error("Gemini no devolvió resultados válidos")
                raise ValueError("Falló el análisis de Gemini")

            criterios_evaluados = {}

            nota_final = 0.0

            info_criterios = {}
            total_peso_rubrica = 0.0
            
            for criterio in rubrica.criterios:
                max_nivel = 0.0
                for nivel in criterio.niveles:
                    if nivel.puntaje_max > max_nivel:
                        max_nivel = nivel.puntaje_max
                
                info_criterios[criterio.nombre_criterio] = {
                    "peso": criterio.peso,
                    "max_puntos": max_nivel if max_nivel > 0 else 20.0
                }
                total_peso_rubrica += criterio.peso

            escala_peso = 100.0 if total_peso_rubrica > 2.0 else 1.0

            for res in resultados_gemini.get("resultados", []):
                criterio_nombre = res.get("criterio")
                puntaje_obtenido = res.get("puntaje_obtenido", 0.0)

                info = info_criterios.get(criterio_nombre)

                peso_criterio = info["peso"] if info else 0.0
                max_puntos_criterio = info["max_puntos"] if info else 20.0
                
                criterios_evaluados[criterio_nombre] = {
                    "nivel": res.get("nivel_asignado"),
                    "score": puntaje_obtenido, 
                    "feedback": res.get("feedback"),
                    "confidence": res.get("confidence", 0.0),
                    "peso": peso_criterio,
                    "comentario": res.get("feedback", "")
                }

                factor_peso = peso_criterio / escala_peso
                contribucion = (puntaje_obtenido / max_puntos_criterio) * factor_peso * 20.0
                nota_final += contribucion

            nota_final = max(0.0, min(20.0, nota_final))

            log.info(f"Análisis completado. Nota final calculada: {nota_final} (Escala pesos: {escala_peso})")

            existing_result = self.resultado_repo.get_by_evaluacion(evaluacion_id)
            if existing_result:
                log.warning(f"Eliminando resultado previo para evaluación {evaluacion_id} antes de guardar nuevo análisis.")
                self.resultado_repo.delete(existing_result.id)

            resultado = self.resultado_repo.create(
                evaluacion_id=evaluacion_id,
                criterios_json=criterios_evaluados,
                nota_final=nota_final
            )

            feedback = resultados_gemini.get("comentarios_generales", "")
            if feedback:
                self.resultado_repo.update_feedback(resultado.id, feedback)

            self.evaluacion_repo.update(evaluacion.id, estado="COMPLETADO")
            
            log.info(f"Análisis completado. Nota final: {nota_final}")
            return resultado

        except Exception as e:
            log.error(f"Error en analyze_evaluation: {e}")
            evaluacion = self.evaluacion_repo.get_by_id(evaluacion_id)
            if evaluacion:
                self.evaluacion_repo.update(evaluacion.id, estado="ERROR")
            raise
