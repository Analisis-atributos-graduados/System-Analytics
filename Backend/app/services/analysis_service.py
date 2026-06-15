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
from app.clients import GCSClient
from app.extractors import ImageExtractor

log = logging.getLogger(__name__)

class AnalysisService:

    def __init__(
            self,
            evaluacion_repo: EvaluacionRepository,
            archivo_repo: ArchivoRepository,
            rubrica_repo: RubricaRepository,
            resultado_repo: ResultadoRepository,
            gemini_analyzer: GeminiAnalyzer,
            gcs_client: Optional[GCSClient] = None,
            image_extractor: Optional[ImageExtractor] = None
    ):
        self.evaluacion_repo = evaluacion_repo
        self.archivo_repo = archivo_repo
        self.rubrica_repo = rubrica_repo
        self.resultado_repo = resultado_repo
        self.analyzer = gemini_analyzer
        self.gcs_client = gcs_client
        self.image_extractor = image_extractor

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
            images_base64 = []
            
            for archivo in archivos:
                if archivo.texto_extraido:
                    full_text += f"\n--- Archivo: {archivo.nombre_archivo_original} ---\n"
                    full_text += archivo.texto_extraido
                
                if archivo.analisis_visual and self.gcs_client:
                    try:
                        visual_data = json.loads(archivo.analisis_visual)
                        gcs_images = visual_data.get("imagenes_gcs", [])
                        if gcs_images:
                            log.info(f"Descargando {len(gcs_images)} imágenes de GCS para evaluación de archivo ID={archivo.id}")
                            for img_filename in gcs_images:
                                try:
                                    img_bytes = self.gcs_client.download_blob(img_filename)
                                    import base64
                                    img_b64 = base64.b64encode(img_bytes).decode('utf-8')
                                    images_base64.append(img_b64)
                                except Exception as img_err:
                                    log.warning(f"Error al descargar o procesar imagen {img_filename} de GCS: {img_err}")
                                    continue
                    except Exception as json_err:
                        log.warning(f"Error al decodificar analisis_visual del archivo {archivo.id}: {json_err}")
                        pass

            resultados_gemini = self.analyzer.analyze_document(
                text=full_text,
                images_base64=images_base64, 
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
            for criterio in rubrica.criterios:
                max_nivel = 0.0
                for nivel in criterio.niveles:
                    if nivel.puntaje > max_nivel:
                        max_nivel = nivel.puntaje
                
                info_criterios[str(criterio.id)] = {
                    "max_puntos": max_nivel if max_nivel > 0 else 20.0
                }

            criterios_by_id = {c.id: c for c in rubrica.criterios}
            unmatched_criterios = list(rubrica.criterios)

            for res in resultados_gemini.get("resultados", []):
                criterio_id = res.get("criterio_id")
                criterio_match = None

                if criterio_id is not None:
                    try:
                        c_id = int(criterio_id)
                        if c_id in criterios_by_id:
                            criterio_match = criterios_by_id[c_id]
                    except (ValueError, TypeError):
                        pass

                if not criterio_match:
                    criterio_nombre = res.get("criterio")
                    if criterio_nombre:
                        criterio_nombre_clean = criterio_nombre.strip().lower()
                        for c in unmatched_criterios:
                            if c.nombre_criterio.strip().lower() == criterio_nombre_clean:
                                criterio_match = c
                                break

                if not criterio_match and unmatched_criterios:
                    criterio_match = unmatched_criterios[0]

                if criterio_match:
                    if criterio_match in unmatched_criterios:
                        unmatched_criterios.remove(criterio_match)
                    key = str(criterio_match.id)
                else:
                    key = res.get("criterio") or f"unknown_{res.get('criterio_id')}"

                puntaje_obtenido = res.get("puntaje_obtenido", 0.0)

                criterios_evaluados[key] = {
                    "nivel": res.get("nivel_asignado"),
                    "score": puntaje_obtenido, 
                    "feedback": res.get("feedback"),
                    "confidence": res.get("confidence", 0.0),
                    "comentario": res.get("feedback", "")
                }

                nota_final += puntaje_obtenido

            nota_final = max(0.0, min(20.0, nota_final))

            log.info(f"Análisis completado. Nota final calculada: {nota_final}")

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
