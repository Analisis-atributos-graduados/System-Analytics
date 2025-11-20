import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.models import get_db, Usuario, Evaluacion
from app.schemas import (
    EvaluacionSchema,
    EvaluacionDetailSchema,
    ExamBatchRequest
)
from app.repositories import EvaluacionRepository
from app.services import OrchestratorService
from app.config.dependencies import get_orchestrator_service, get_current_user, require_role

log = logging.getLogger(__name__)

router = APIRouter(prefix="/evaluaciones", tags=["Evaluaciones"])


@router.get("")
async def list_evaluaciones(
    semestre: Optional[str] = Query(None),
    curso: Optional[str] = Query(None),
    tema: Optional[str] = Query(None),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lista evaluaciones con filtros opcionales.
    Respeta permisos según rol.
    """
    try:
        repo = EvaluacionRepository(db)
        query = db.query(Evaluacion)

        # Si es profesor, solo sus evaluaciones
        if current_user.rol.value == "PROFESOR":
            query = query.filter(Evaluacion.profesor_id == current_user.id)

        # Aplicar filtros
        if semestre:
            query = query.filter(Evaluacion.semestre == semestre)
        if curso:
            query = query.filter(Evaluacion.codigo_curso == curso)
        if tema:
            query = query.filter(Evaluacion.tema == tema)

        evaluaciones = query.all()

        log.info(f"Listadas {len(evaluaciones)} evaluaciones para {current_user.rol.value}")
        return evaluaciones

    except Exception as e:
        log.error(f"Error al listar evaluaciones: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{evaluacion_id}", response_model=EvaluacionDetailSchema)
async def get_evaluacion_detail(
    evaluacion_id: int,
    db: Session = Depends(get_db)
):
    """
    Obtiene detalles completos de una evaluación (con archivos y resultados).
    """
    try:
        repo = EvaluacionRepository(db)
        evaluacion = repo.get_with_details(evaluacion_id)

        if not evaluacion:
            raise HTTPException(status_code=404, detail="Evaluación no encontrada")

        log.info(f"Evaluación obtenida: ID={evaluacion_id}")
        return evaluacion

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error al obtener evaluación {evaluacion_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/enqueue-exam-batch")
async def enqueue_exam_batch(
    request: ExamBatchRequest,
    current_user: Usuario = Depends(require_role("PROFESOR")),
    orchestrator: OrchestratorService = Depends(get_orchestrator_service)
):
    """
    Orquestador principal: procesa un lote de exámenes o ensayos.
    Ahora requiere autenticación y usa rubrica_id.
    """
    try:
        log.info(f"Recibido lote de {current_user.nombre}: {len(request.pdf_files)} archivos")

        result = orchestrator.process_exam_batch(
            profesor_id=current_user.id,
            rubrica_id=request.rubrica_id,
            pdf_files=[f.dict() for f in request.pdf_files],
            student_list=request.student_list,
            nombre_curso=request.nombre_curso,
            codigo_curso=request.codigo_curso,
            instructor=current_user.nombre,
            semestre=request.semestre,
            tema=request.tema,
            descripcion_tema=request.descripcion_tema or "",
            tipo_documento=request.tipo_documento
        )

        return result

    except Exception as e:
        log.error(f"Error en enqueue_exam_batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{evaluacion_id}")
async def delete_evaluacion(
    evaluacion_id: int,
    db: Session = Depends(get_db)
):
    """
    Elimina una evaluación (y sus archivos/resultados asociados por CASCADE).
    """
    try:
        repo = EvaluacionRepository(db)
        deleted = repo.delete(evaluacion_id)

        if not deleted:
            raise HTTPException(status_code=404, detail="Evaluación no encontrada")

        log.info(f"Evaluación eliminada: ID={evaluacion_id}")
        return {"success": True, "evaluacion_id": evaluacion_id}

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error al eliminar evaluación {evaluacion_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
