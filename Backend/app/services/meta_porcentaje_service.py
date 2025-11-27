import logging
from sqlalchemy.orm import Session
from app.repositories.meta_porcentaje_repository import MetaPorcentajeRepository
from app.models import MetaPorcentaje
from app.schemas.meta_porcentaje_schemas import MetaPorcentajeUpdate

log = logging.getLogger(__name__)


class MetaPorcentajeService:
    """Service para gestión de meta de porcentaje."""

    def __init__(self, db: Session):
        self.meta_repo = MetaPorcentajeRepository(db)

    def get_meta(self) -> MetaPorcentaje:
        """Obtiene la meta de porcentaje actual."""
        return self.meta_repo.get_meta()

    def update_meta(self, data: MetaPorcentajeUpdate) -> MetaPorcentaje:
        """Actualiza el porcentaje objetivo."""
        if data.porcentaje < 0 or data.porcentaje > 100:
            raise ValueError("El porcentaje debe estar entre 0 y 100")
        
        return self.meta_repo.update_meta(data.porcentaje)
