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
    """
    Servicio principal de análisis de documentos usando Gemini 1.5 Pro via GeminiAnalyzer.
    Reemplaza la antigua lógica de DeBERTa + Sliding Window.
    """

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
        """
        Ejecuta el análisis completo de una evaluación.
        """
        try:
            log.info(f"Iniciando análisis para evaluación {evaluacion_id}")
            
            # 1. Obtener datos
            evaluacion = self.evaluacion_repo.get_by_id(evaluacion_id)
            if not evaluacion:
                raise ValueError(f"Evaluación {evaluacion_id} no encontrada")

            rubrica = self.rubrica_repo.get_by_id(evaluacion.rubrica_id)
            if not rubrica:
                raise ValueError("Rúbrica no encontrada")

            archivos = self.archivo_repo.get_by_evaluacion(evaluacion_id)
            if not archivos:
                raise ValueError("No hay archivos para analizar")

            # 2. Preparar contenido acumulado
            full_text = ""
            # Nota: Por ahora no estamos recuperando las imágenes originales en base64 desde la BD
            # porque el extraction_service anterior no las guardaba (solo guardaba el análisis).
            # Para esta migración, confiaremos en la capacidad de Gemini de analizar el texto transcrito
            # (que incluye descripciones de OCR si aplica).
            # Si se requiere análisis visual real, se debe actualizar extraction_service para guardar los blobs.
            
            for archivo in archivos:
                if archivo.texto_extraido:
                    full_text += f"\n--- Archivo: {archivo.nombre_archivo_original} ---\n"
                    full_text += archivo.texto_extraido

            # 3. Analizar con Gemini
            # Pasamos lista vacía de imágenes por la limitación mencionada arriba,
            # pero el servicio soporta recibirlas si se implementa la persistencia.
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

            # 4. Procesar resultados y guardar
            # 4. Procesar resultados y guardar
            criterios_evaluados = {}
            
            # Variables para cálculo de nota
            nota_final = 0.0
            
            # Mapa de criterios para acceso rápido a info de rúbrica (peso, max_puntaje)
            info_criterios = {}
            total_peso_rubrica = 0.0
            
            for criterio in rubrica.criterios:
                max_nivel = 0.0
                for nivel in criterio.niveles:
                    if nivel.puntaje_max > max_nivel:
                        max_nivel = nivel.puntaje_max
                
                info_criterios[criterio.nombre_criterio] = {
                    "peso": criterio.peso,
                    "max_puntos": max_nivel if max_nivel > 0 else 20.0 # Fallback
                }
                total_peso_rubrica += criterio.peso

            # Determinar escala de pesos (0-1 o 0-100)
            # Si la suma es mayor a 2.0, asumimos que están en escala 0-100 (ej: 30, 40, 30)
            # Si es menor o igual a 2.0, asumimos escala 0-1 (ej: 0.3, 0.4, 0.3)
            escala_peso = 100.0 if total_peso_rubrica > 2.0 else 1.0

            # Procesar resultados de Gemini
            for res in resultados_gemini.get("resultados", []):
                criterio_nombre = res.get("criterio")
                puntaje_obtenido = res.get("puntaje_obtenido", 0.0)
                
                # Obtener info del criterio de la rúbrica
                info = info_criterios.get(criterio_nombre)
                # Si no encuentra el criterio, asumimos peso 0 para no romper, pero logueamos warning idealmente
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
                
                # Cálculo Ponderado:
                # (Puntaje Obtenido / Max Puntos del Criterio) * (Peso / Escala) * 20
                # Esto normaliza el criterio a 20 y le aplica su peso proporcional.
                factor_peso = peso_criterio / escala_peso
                contribucion = (puntaje_obtenido / max_puntos_criterio) * factor_peso * 20.0
                nota_final += contribucion

            # Capar nota entre 0 y 20 por seguridad
            nota_final = max(0.0, min(20.0, nota_final))

            log.info(f"Análisis completado. Nota final calculada: {nota_final} (Escala pesos: {escala_peso})")

            # 5. Guardar Resultado usando el método específico del repositorio
            
            # Verificar si ya existe un resultado previo (reintentos) y eliminarlo
            existing_result = self.resultado_repo.get_by_evaluacion(evaluacion_id)
            if existing_result:
                log.warning(f"Eliminando resultado previo para evaluación {evaluacion_id} antes de guardar nuevo análisis.")
                self.resultado_repo.delete(existing_result.id)

            resultado = self.resultado_repo.create(
                evaluacion_id=evaluacion_id,
                criterios_json=criterios_evaluados,
                nota_final=nota_final
            )
            
            # Actualizar feedback general si existe
            feedback = resultados_gemini.get("comentarios_generales", "")
            if feedback:
                self.resultado_repo.update_feedback(resultado.id, feedback)
            
            # Actualizar estado de la evaluación
            self.evaluacion_repo.update(evaluacion.id, estado="COMPLETADO")
            
            log.info(f"Análisis completado. Nota final: {nota_final}")
            return resultado

        except Exception as e:
            log.error(f"Error en analyze_evaluation: {e}")
            evaluacion = self.evaluacion_repo.get_by_id(evaluacion_id)
            if evaluacion:
                self.evaluacion_repo.update(evaluacion.id, estado="ERROR")
            raise
