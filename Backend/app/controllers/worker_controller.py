import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.models import get_db
from app.schemas import FileTaskPayload, EvaluationTaskPayload
from app.services import ExtractionService, AnalysisService, TaskService
from app.repositories import EvaluacionRepository
from app.config.dependencies import (
    get_extraction_service,
    get_analysis_service,
    get_task_service
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Workers"])


@router.post("/process-file-task")
async def process_file_task(
        payload: FileTaskPayload,
        background_tasks: BackgroundTasks,
        db: Session = Depends(get_db),
        extraction_service: ExtractionService = Depends(get_extraction_service),
        task_service: TaskService = Depends(get_task_service)
):

    try:
        log.info(f"Worker iniciado: archivo={payload.original_filename}, evaluacion_id={payload.evaluacion_id}")

        evaluacion_repo = EvaluacionRepository(db)
        evaluacion = evaluacion_repo.get_by_id(payload.evaluacion_id)

        if not evaluacion:
            log.error(f"Evaluación no encontrada: {payload.evaluacion_id}")
            return {"error": "Evaluación no encontrada"}

        result = extraction_service.process_file(
            gcs_filename=payload.gcs_filename,
            original_filename=payload.original_filename,
            evaluacion_id=payload.evaluacion_id,
            tipo_documento=payload.tipo_documento,
            tema=evaluacion.tema,
            descripcion_tema=evaluacion.descripcion_tema or ""
        )

        archivos = evaluacion_repo.get_with_details(payload.evaluacion_id).archivos_procesados

        if len(archivos) > 0:
            log.info(f"Encolando tarea de evaluación final para evaluacion_id={payload.evaluacion_id}")
            task_service.create_evaluation_task(
                evaluacion_id=payload.evaluacion_id,
                delay_seconds=5
            )

        log.info(f"Worker completado: archivo_id={result['archivo_id']}")

        return {
            "success": True,
            "archivo_id": result['archivo_id'],
            "evaluacion_id": payload.evaluacion_id
        }

    except Exception as e:
        log.error(f"Error en process_file_task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/process-evaluation-task")
async def process_evaluation_task(
        payload: EvaluationTaskPayload,
        db: Session = Depends(get_db),
        analysis_service: AnalysisService = Depends(get_analysis_service)
):
    try:
        log.info(f"Worker evaluación iniciado: evaluacion_id={payload.evaluacion_id}")

        result = analysis_service.analyze_evaluation(
            evaluacion_id=payload.evaluacion_id
        )

        if not result:
            log.error(f"Análisis falló o devolvió vacío para ID {payload.evaluacion_id}")
            raise HTTPException(status_code=500, detail="Error en el análisis")

        log.info(f"Worker evaluación completado: evaluacion_id={payload.evaluacion_id}")

        return {
            "success": True,
            "evaluacion_id": payload.evaluacion_id
        }

    except Exception as e:
        log.error(f"Error en process_evaluation_task: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))