from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.config.database import get_db
from app.services.curso_service import CursoService
from app.schemas.curso_schemas import CursoSchema, CursoCreate, CursoUpdate, BulkAttributeAssignmentSchema
from app.config.dependencies import require_role

router = APIRouter(
    prefix="/cursos",
    tags=["Cursos"]
)

@router.get("", response_model=List[CursoSchema])
def get_cursos(
    habilitados_only: bool = False,
    db: Session = Depends(get_db)
):

    service = CursoService(db)
    if habilitados_only:
        return service.get_cursos_habilitados()
    return service.get_all_cursos()

@router.post("", response_model=CursoSchema, status_code=status.HTTP_201_CREATED)
def create_curso(
    curso: CursoCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("AREA_CALIDAD"))
):

    service = CursoService(db)
    try:
        return service.create_curso(curso)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{curso_id}", response_model=CursoSchema)
def update_curso(
    curso_id: int,
    curso: CursoUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("AREA_CALIDAD"))
):

    service = CursoService(db)
    try:
        return service.update_curso(curso_id, curso)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.patch("/{curso_id}/toggle", response_model=CursoSchema)
def toggle_curso(
    curso_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("AREA_CALIDAD"))
):

    service = CursoService(db)
    try:
        return service.toggle_habilitado(curso_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

@router.delete("/{curso_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_curso(
    curso_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("AREA_CALIDAD"))
):

    service = CursoService(db)
    try:
        service.delete_curso(curso_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail="No se puede eliminar el curso (posiblemente tiene evaluaciones asociadas)")

@router.post("/assign-attributes", status_code=status.HTTP_200_OK)
def assign_attributes(
    payload: BulkAttributeAssignmentSchema,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("AREA_CALIDAD"))
):

    from app.services.meta_porcentaje_service import MetaPorcentajeService
    from app.schemas.meta_porcentaje_schemas import MetaPorcentajeUpdate
    
    curso_service = CursoService(db)
    meta_service = MetaPorcentajeService(db)
    
    try:
        update_data = MetaPorcentajeUpdate(porcentaje=payload.meta)
        meta_service.update_meta(update_data)

        assignments_dicts = [a.dict() for a in payload.asignaciones]
        curso_service.bulk_assign_attributes(assignments_dicts)
        
        return {"message": "Configuración guardada correctamente"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar configuración: {str(e)}")
