import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models import MetaPorcentaje
from app.repositories.base_repository import BaseRepository

log = logging.getLogger(__name__)


class MetaPorcentajeRepository(BaseRepository):

    def __init__(self, db: Session):
        super().__init__(db, MetaPorcentaje)

    def get_meta(self) -> Optional[MetaPorcentaje]:

        try:
            meta = self.db.query(MetaPorcentaje).first()

            if not meta:
                log.info("No existe meta de porcentaje, creando con valor por defecto (80)")
                meta = MetaPorcentaje(porcentaje=80)
                self.db.add(meta)
                self.db.commit()
                self.db.refresh(meta)
            
            return meta
        except Exception as e:
            log.error(f"Error al obtener meta de porcentaje: {e}")
            raise

    def update_meta(self, porcentaje: int) -> MetaPorcentaje:

        try:
            meta = self.get_meta()
            meta.porcentaje = porcentaje
            self.db.commit()
            self.db.refresh(meta)
            log.info(f"Meta de porcentaje actualizada a {porcentaje}%")
            return meta
        except Exception as e:
            log.error(f"Error al actualizar meta de porcentaje: {e}")
            self.db.rollback()
            raise
