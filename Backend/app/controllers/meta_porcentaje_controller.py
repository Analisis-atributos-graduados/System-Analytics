from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.services.meta_porcentaje_service import MetaPorcentajeService
from app.schemas.meta_porcentaje_schemas import MetaPorcentajeSchema, MetaPorcentajeUpdate
from app.config.dependencies import require_role

router = APIRouter(
    prefix="/meta-porcentaje",
    tags=["Meta Porcentaje"]
)

@router.get("", response_model=MetaPorcentajeSchema)
def get_meta(db: Session = Depends(get_db)):
    """Obtiene la meta de porcentaje actual."""
    service = MetaPorcentajeService(db)
    return service.get_meta()

@router.put("", response_model=MetaPorcentajeSchema)
def update_meta(
    meta: MetaPorcentajeUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("AREA_CALIDAD"))
):
    """Actualiza la meta de porcentaje (Solo Área de Calidad)."""
    service = MetaPorcentajeService(db)
    try:
        return service.update_meta(meta)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
