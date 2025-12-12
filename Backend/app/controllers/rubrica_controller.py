import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models import get_db, Usuario
from app.schemas import RubricaCreate, RubricaResponse, RubricaListResponse
from app.repositories import RubricaRepository
from app.config.dependencies import get_current_user, require_role

log = logging.getLogger(__name__)

router = APIRouter(prefix="/rubricas", tags=["Rúbricas"])


@router.post("", response_model=RubricaResponse)
async def create_rubrica(
        rubrica_data: RubricaCreate,
        current_user: Usuario = Depends(require_role("PROFESOR")),
        db: Session = Depends(get_db)
):

    try:
        rubrica_repo = RubricaRepository(db)

        suma_pesos = sum(c.peso for c in rubrica_data.criterios)
        if abs(suma_pesos - 1.0) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"La suma de los pesos debe ser 1.0 (actual: {suma_pesos:.2f})"
            )

        criterios_dict = [c.dict() for c in rubrica_data.criterios]
        rubrica = rubrica_repo.create_rubrica_con_criterios(
            profesor_id=current_user.id,
            nombre_rubrica=rubrica_data.nombre_rubrica,
            descripcion=rubrica_data.descripcion,
            criterios=criterios_dict
        )

        rubrica = rubrica_repo.get_with_criterios(rubrica.id)

        log.info(f"Rúbrica creada: ID={rubrica.id}, Profesor={current_user.nombre}")
        return rubrica

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error al crear rúbrica: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=List[RubricaListResponse])
async def list_rubricas(
        current_user: Usuario = Depends(require_role("PROFESOR")),
        db: Session = Depends(get_db)
):

    try:
        rubrica_repo = RubricaRepository(db)
        rubricas = rubrica_repo.get_by_profesor_with_criterios(current_user.id)

        log.info(f"Listadas {len(rubricas)} rúbricas del profesor {current_user.nombre}")
        return rubricas

    except Exception as e:
        log.error(f"Error al listar rúbricas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{rubrica_id}", response_model=RubricaResponse)
async def get_rubrica(
        rubrica_id: int,
        current_user: Usuario = Depends(require_role("PROFESOR")),
        db: Session = Depends(get_db)
):

    try:
        rubrica_repo = RubricaRepository(db)
        rubrica = rubrica_repo.get_with_criterios(rubrica_id)

        if not rubrica:
            raise HTTPException(status_code=404, detail="Rúbrica no encontrada")

        if rubrica.profesor_id != current_user.id:
            raise HTTPException(status_code=403, detail="No tienes permiso para ver esta rúbrica")

        return rubrica

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error al obtener rúbrica: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{rubrica_id}")
async def delete_rubrica(
        rubrica_id: int,
        current_user: Usuario = Depends(require_role("PROFESOR")),
        db: Session = Depends(get_db)
):

    try:
        rubrica_repo = RubricaRepository(db)
        rubrica = rubrica_repo.get_by_id(rubrica_id)

        if not rubrica:
            raise HTTPException(status_code=404, detail="Rúbrica no encontrada")

        if rubrica.profesor_id != current_user.id:
            raise HTTPException(status_code=403, detail="No tienes permiso para eliminar esta rúbrica")

        rubrica.activo = False
        db.commit()

        log.info(f"Rúbrica {rubrica_id} desactivada por profesor {current_user.nombre}")
        return {"message": "Rúbrica eliminada exitosamente"}

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error al eliminar rúbrica: {e}")
        raise HTTPException(status_code=500, detail=str(e))
