import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.models import get_db, Usuario
from app.schemas import RubricaCreate, RubricaResponse, RubricaListResponse, RubricaRevisionSchema
from app.repositories import RubricaRepository
from app.config.dependencies import get_current_user, require_role

log = logging.getLogger(__name__)

router = APIRouter(prefix="/rubricas", tags=["Rúbricas"])


@router.post("", response_model=RubricaResponse)
async def create_rubrica(
        rubrica_data: RubricaCreate,
        current_user: Usuario = Depends(require_role("COMITE_ACADEMICO")),
        db: Session = Depends(get_db)
):
    try:
        rubrica_repo = RubricaRepository(db)

        if rubrica_data.nrc_id:
            existing = rubrica_repo.get_by_nrc_with_criterios(rubrica_data.nrc_id)
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Ya existe una rúbrica para el NRC {rubrica_data.nrc_id}."
                )

        suma_pesos = sum(c.peso for c in rubrica_data.criterios)
        if abs(suma_pesos - 1.0) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"La suma de los pesos debe ser 1.0 (actual: {suma_pesos:.2f})"
            )

        criterios_dict = [c.dict() for c in rubrica_data.criterios]
        rubrica = rubrica_repo.create_rubrica_con_criterios(
            nombre_rubrica=rubrica_data.nombre_rubrica,
            descripcion=rubrica_data.descripcion,
            nrc_id=rubrica_data.nrc_id,
            criterios=criterios_dict
        )

        rubrica = rubrica_repo.get_with_criterios(rubrica.id)
        log.info(f"Rúbrica creada para NRC {rubrica.nrc_id}: ID={rubrica.id}, Comité={current_user.nombre}")
        return rubrica

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error al crear rúbrica: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{rubrica_id}", response_model=RubricaResponse)
async def update_rubrica(
        rubrica_id: int,
        rubrica_data: RubricaCreate,
        current_user: Usuario = Depends(require_role("COMITE_ACADEMICO")),
        db: Session = Depends(get_db)
):
    try:
        rubrica_repo = RubricaRepository(db)
        rubrica = rubrica_repo.get_with_criterios(rubrica_id)
        if not rubrica:
            raise HTTPException(status_code=404, detail="Rúbrica no encontrada")

        suma_pesos = sum(c.peso for c in rubrica_data.criterios)
        if abs(suma_pesos - 1.0) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"La suma de los pesos debe ser 1.0 (actual: {suma_pesos:.2f})"
            )

        criterios_dict = [c.dict() for c in rubrica_data.criterios]
        updated_rubrica = rubrica_repo.update_rubrica_con_criterios(
            rubrica_id=rubrica_id,
            nombre_rubrica=rubrica_data.nombre_rubrica,
            descripcion=rubrica_data.descripcion,
            nrc_id=rubrica_data.nrc_id,
            criterios=criterios_dict
        )

        return updated_rubrica

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error al actualizar rúbrica {rubrica_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=List[RubricaListResponse])
async def list_rubricas(
        nrc_id: Optional[int] = None,
        current_user: Usuario = Depends(require_role("PROFESOR", "COMITE_ACADEMICO", "DOCENTE_CIAC", "DIRECTOR_ESCUELA")),
        db: Session = Depends(get_db)
):
    try:
        rubrica_repo = RubricaRepository(db)
        
        if nrc_id:
            rubrica = rubrica_repo.get_by_nrc_with_criterios(nrc_id)
            if not rubrica:
                return []

            if getattr(current_user, 'active_role', current_user.rol) == "PROFESOR":
                if rubrica.estado_ciac != 'aprobado' or rubrica.estado_director != 'aprobado':
                    return []
            return [rubrica]

        if getattr(current_user, 'active_role', current_user.rol) in ["COMITE_ACADEMICO", "DOCENTE_CIAC", "DIRECTOR_ESCUELA"]:
            rubricas = rubrica_repo.get_all_with_criterios()
        else:
            rubricas = rubrica_repo.get_all_active_with_criterios()

        return rubricas

    except Exception as e:
        log.error(f"Error al listar rúbricas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{rubrica_id}", response_model=RubricaResponse)
async def get_rubrica(
        rubrica_id: int,
        current_user: Usuario = Depends(require_role("PROFESOR", "COMITE_ACADEMICO", "DOCENTE_CIAC", "DIRECTOR_ESCUELA")),
        db: Session = Depends(get_db)
):
    try:
        rubrica_repo = RubricaRepository(db)
        rubrica = rubrica_repo.get_with_criterios(rubrica_id)

        if not rubrica:
            raise HTTPException(status_code=404, detail="Rúbrica no encontrada")

        if getattr(current_user, 'active_role', current_user.rol) == "PROFESOR":
            if rubrica.estado_ciac != 'aprobado' or rubrica.estado_director != 'aprobado':
                raise HTTPException(status_code=403, detail="La rúbrica no está aprobada para su uso")

        return rubrica

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error al obtener rúbrica: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{rubrica_id}/aprobar-ciac")
async def aprobar_ciac(
        rubrica_id: int,
        payload: RubricaRevisionSchema,
        current_user: Usuario = Depends(require_role("DOCENTE_CIAC")),
        db: Session = Depends(get_db)
):
    try:
        rubrica_repo = RubricaRepository(db)
        rubrica = rubrica_repo.get_by_id(rubrica_id)
        if not rubrica:
            raise HTTPException(status_code=404, detail="Rúbrica no encontrada")

        rubrica.estado_ciac = 'aprobado' if payload.aprobado else 'rechazado'
        rubrica.mensaje_ciac = payload.mensaje
        db.commit()
        log.info(f"Rúbrica {rubrica_id} revisada por Docente CIAC: {rubrica.estado_ciac}")
        return {"message": f"Rúbrica {rubrica.estado_ciac} correctamente por el Docente CIAC"}
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error al aprobar CIAC para rúbrica {rubrica_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{rubrica_id}/aprobar-director")
async def aprobar_director(
        rubrica_id: int,
        payload: RubricaRevisionSchema,
        current_user: Usuario = Depends(require_role("DIRECTOR_ESCUELA")),
        db: Session = Depends(get_db)
):
    try:
        rubrica_repo = RubricaRepository(db)
        rubrica = rubrica_repo.get_by_id(rubrica_id)
        if not rubrica:
            raise HTTPException(status_code=404, detail="Rúbrica no encontrada")

        rubrica.estado_director = 'aprobado' if payload.aprobado else 'rechazado'
        rubrica.mensaje_director = payload.mensaje
        db.commit()
        log.info(f"Rúbrica {rubrica_id} revisada por Director de Escuela: {rubrica.estado_director}")
        return {"message": f"Rúbrica {rubrica.estado_director} correctamente por el Director de Escuela"}
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error al aprobar Director para rúbrica {rubrica_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{rubrica_id}")
async def delete_rubrica(
        rubrica_id: int,
        current_user: Usuario = Depends(require_role("COMITE_ACADEMICO")),
        db: Session = Depends(get_db)
):
    try:
        rubrica_repo = RubricaRepository(db)
        rubrica = rubrica_repo.get_by_id(rubrica_id)

        if not rubrica:
            raise HTTPException(status_code=404, detail="Rúbrica no encontrada")

        db.delete(rubrica)
        db.commit()

        log.info(f"Rúbrica {rubrica_id} eliminada por comité {current_user.nombre}")
        return {"message": "Rúbrica eliminada exitosamente"}

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error al eliminar rúbrica: {e}")
        raise HTTPException(status_code=500, detail=str(e))
