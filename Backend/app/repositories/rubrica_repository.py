import logging
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from app.models import Rubrica, Criterio, Nivel
from app.repositories.base_repository import BaseRepository

log = logging.getLogger(__name__)


class RubricaRepository(BaseRepository):

    def __init__(self, db: Session):
        super().__init__(db, Rubrica)

    def get_by_profesor(self, profesor_id: int) -> List[Rubrica]:

        try:
            return (
                self.db.query(Rubrica)
                .filter(Rubrica.profesor_id == profesor_id)
                .filter(Rubrica.activo == True)
                .order_by(Rubrica.id.desc())
                .all()
            )
        except Exception as e:
            log.error(f"Error al obtener rúbricas del profesor {profesor_id}: {e}")
            raise

    def get_by_profesor_with_criterios(self, profesor_id: int) -> List[Rubrica]:

        try:
            return (
                self.db.query(Rubrica)
                .options(
                    joinedload(Rubrica.criterios).joinedload(Criterio.niveles)
                )
                .filter(Rubrica.profesor_id == profesor_id)
                .filter(Rubrica.activo == True)
                .order_by(Rubrica.id.desc())
                .all()
            )
        except Exception as e:
            log.error(f"Error al obtener rúbricas con criterios del profesor {profesor_id}: {e}")
            raise

    def get_with_criterios(self, rubrica_id: int) -> Optional[Rubrica]:

        try:
            return (
                self.db.query(Rubrica)
                .options(
                    joinedload(Rubrica.criterios).joinedload(Criterio.niveles)
                )
                .filter(Rubrica.id == rubrica_id)
                .first()
            )
        except Exception as e:
            log.error(f"Error al obtener rúbrica {rubrica_id} con criterios: {e}")
            raise

    def create_rubrica_con_criterios(
            self,
            profesor_id: int,
            nombre_rubrica: str,
            descripcion: str,
            criterios: List[dict]
    ) -> Rubrica:

        try:
            log.info(f"Creando rúbrica: {nombre_rubrica}")

            rubrica = Rubrica(
                profesor_id=profesor_id,
                nombre_rubrica=nombre_rubrica,
                descripcion=descripcion,
                activo=True
            )
            self.db.add(rubrica)
            self.db.flush()

            for criterio_data in criterios:
                criterio = Criterio(
                    rubrica_id=rubrica.id,
                    nombre_criterio=criterio_data.get("nombre_criterio", ""),
                    descripcion_criterio=criterio_data.get("descripcion_criterio", ""),
                    peso=criterio_data.get("peso", 0),
                    orden=criterio_data.get("orden", 0)
                )
                self.db.add(criterio)
                self.db.flush()

                for nivel_data in criterio_data.get("niveles", []):
                    nivel = Nivel(
                        criterio_id=criterio.id,
                        nombre_nivel=nivel_data.get("nombre_nivel", ""),
                        puntaje_min=nivel_data.get("puntaje_min", 0),
                        puntaje_max=nivel_data.get("puntaje_max", 0),
                        descriptores=nivel_data.get("descriptores", []),
                        orden=nivel_data.get("orden", 0)
                    )
                    self.db.add(nivel)

            self.db.commit()
            self.db.refresh(rubrica)

            log.info(f"Rúbrica {rubrica.id} creada con {len(criterios)} criterios")
            return rubrica

        except Exception as e:
            log.error(f"Error al crear rúbrica: {e}")
            self.db.rollback()
            raise
