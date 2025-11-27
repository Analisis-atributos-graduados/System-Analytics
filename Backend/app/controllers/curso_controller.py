from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.config.database import get_db
from app.services.curso_service import CursoService
from app.schemas.curso_schemas import CursoSchema, CursoCreate, CursoUpdate
from app.config.dependencies import require_role

router = APIRouter(
    prefix="/cursos",
    tags=["Cursos"]
)

@router.get("/", response_model=List[CursoSchema])
def get_cursos(
    habilitados_only: bool = False,
    db: Session = Depends(get_db)
):
    """
    Obtiene la lista de cursos.
    Si habilitados_only=True, devuelve solo los habilitados (para profesores).
    Si no, devuelve todos (para admin/calidad).
    """
    service = CursoService(db)
    if habilitados_only:
        return service.get_cursos_habilitados()
    return service.get_all_cursos()

@router.post("/", response_model=CursoSchema, status_code=status.HTTP_201_CREATED)
def create_curso(
    curso: CursoCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("AREA_CALIDAD"))
):
    """Crea un nuevo curso (Solo Área de Calidad)."""
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
    """Actualiza un curso (Solo Área de Calidad)."""
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
    """Habilita/Deshabilita un curso (Solo Área de Calidad)."""
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
    """Elimina un curso (Solo Área de Calidad)."""
    service = CursoService(db)
    try:
        service.delete_curso(curso_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail="No se puede eliminar el curso (posiblemente tiene evaluaciones asociadas)")
