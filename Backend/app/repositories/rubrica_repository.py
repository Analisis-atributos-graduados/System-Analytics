import logging
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from app.models import Rubrica, Criterio, Nivel
from app.repositories.base_repository import BaseRepository

log = logging.getLogger(__name__)


class RubricaRepository(BaseRepository):

    def __init__(self, db: Session):
        super().__init__(db, Rubrica)

    def get_all_active_with_criterios(self) -> List[Rubrica]:
        try:
            return (
                self.db.query(Rubrica)
                .options(
                    joinedload(Rubrica.criterios).joinedload(Criterio.niveles)
                )
                .filter(Rubrica.estado_ciac == 'aprobado')
                .filter(Rubrica.estado_director == 'aprobado')
                .order_by(Rubrica.id.desc())
                .all()
            )
        except Exception as e:
            log.error(f"Error al obtener todas las rúbricas activas: {e}")
            raise

    def get_all_with_criterios(self) -> List[Rubrica]:
        try:
            return (
                self.db.query(Rubrica)
                .options(
                    joinedload(Rubrica.criterios).joinedload(Criterio.niveles)
                )
                .order_by(Rubrica.id.desc())
                .all()
            )
        except Exception as e:
            log.error(f"Error al obtener todas las rúbricas: {e}")
            raise

    def update_rubrica_con_criterios(
            self,
            rubrica_id: int,
            nombre_rubrica: str,
            descripcion: str,
            nrc_id: Optional[int],
            criterios: List[dict]
    ) -> Rubrica:
        try:
            log.info(f"Actualizando rúbrica {rubrica_id}: {nombre_rubrica} para nrc_id: {nrc_id}")
            rubrica = self.get_with_criterios(rubrica_id)
            if not rubrica:
                raise ValueError(f"Rúbrica con ID {rubrica_id} no encontrada")

            rubrica.nombre_rubrica = nombre_rubrica
            rubrica.descripcion = descripcion
            rubrica.nrc_id = nrc_id
            rubrica.estado_ciac = 'pendiente'
            rubrica.mensaje_ciac = None
            rubrica.estado_director = 'pendiente'
            rubrica.mensaje_director = None

            existing_criterios = sorted(rubrica.criterios, key=lambda c: c.orden)

            for i, criterio_data in enumerate(criterios):
                if i < len(existing_criterios):
                    criterio = existing_criterios[i]
                    criterio.nombre_criterio = criterio_data.get("nombre_criterio", "")
                    criterio.descripcion_criterio = criterio_data.get("descripcion_criterio", "")
                    criterio.orden = criterio_data.get("orden", i + 1)

                    existing_niveles = sorted(criterio.niveles, key=lambda n: n.orden)
                    new_niveles_data = criterio_data.get("niveles", [])

                    for j, nivel_data in enumerate(new_niveles_data):
                        if j < len(existing_niveles):
                            nivel = existing_niveles[j]
                            nivel.nombre_nivel = nivel_data.get("nombre_nivel", "")
                            nivel.puntaje = nivel_data.get("puntaje", 0)
                            nivel.descriptores = nivel_data.get("descriptores", [])
                            nivel.orden = nivel_data.get("orden", j + 1)
                        else:
                            nuevo_nivel = Nivel(
                                criterio_id=criterio.id,
                                nombre_nivel=nivel_data.get("nombre_nivel", ""),
                                puntaje=nivel_data.get("puntaje", 0),
                                descriptores=nivel_data.get("descriptores", []),
                                orden=nivel_data.get("orden", j + 1)
                            )
                            self.db.add(nuevo_nivel)

                    for nivel in existing_niveles[len(new_niveles_data):]:
                        self.db.delete(nivel)

                else:
                    nuevo_criterio = Criterio(
                        rubrica_id=rubrica.id,
                        nombre_criterio=criterio_data.get("nombre_criterio", ""),
                        descripcion_criterio=criterio_data.get("descripcion_criterio", ""),
                        orden=criterio_data.get("orden", i + 1)
                    )
                    self.db.add(nuevo_criterio)
                    self.db.flush()

                    for nivel_data in criterio_data.get("niveles", []):
                        nuevo_nivel = Nivel(
                            criterio_id=nuevo_criterio.id,
                            nombre_nivel=nivel_data.get("nombre_nivel", ""),
                            puntaje=nivel_data.get("puntaje", 0),
                            descriptores=nivel_data.get("descriptores", []),
                            orden=nivel_data.get("orden", 0)
                        )
                        self.db.add(nuevo_nivel)

            for criterio in existing_criterios[len(criterios):]:
                for nivel in criterio.niveles:
                    self.db.delete(nivel)
                self.db.flush()
                self.db.delete(criterio)

            self.db.commit()
            self.db.refresh(rubrica)
            log.info(f"Rúbrica {rubrica.id} actualizada exitosamente")
            return rubrica
        except Exception as e:
            log.error(f"Error al actualizar rúbrica: {e}")
            self.db.rollback()
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

    def get_by_nrc_with_criterios(self, nrc_id: int) -> Optional[Rubrica]:
        try:
            return (
                self.db.query(Rubrica)
                .options(
                    joinedload(Rubrica.criterios).joinedload(Criterio.niveles)
                )
                .filter(Rubrica.nrc_id == nrc_id)
                .first()
            )
        except Exception as e:
            log.error(f"Error al obtener rúbrica por nrc_id {nrc_id} con criterios: {e}")
            raise

    def create_rubrica_con_criterios(
            self,
            nombre_rubrica: str,
            descripcion: str,
            nrc_id: Optional[int],
            criterios: List[dict]
    ) -> Rubrica:
        try:
            log.info(f"Creando rúbrica: {nombre_rubrica} para nrc_id: {nrc_id}")

            rubrica = Rubrica(
                nombre_rubrica=nombre_rubrica,
                descripcion=descripcion,
                nrc_id=nrc_id,
                estado_ciac='pendiente',
                estado_director='pendiente'
            )
            self.db.add(rubrica)
            self.db.flush()

            for criterio_data in criterios:
                criterio = Criterio(
                    rubrica_id=rubrica.id,
                    nombre_criterio=criterio_data.get("nombre_criterio", ""),
                    descripcion_criterio=criterio_data.get("descripcion_criterio", ""),
                    orden=criterio_data.get("orden", 0)
                )
                self.db.add(criterio)
                self.db.flush()

                for nivel_data in criterio_data.get("niveles", []):
                    nivel = Nivel(
                        criterio_id=criterio.id,
                        nombre_nivel=nivel_data.get("nombre_nivel", ""),
                        puntaje=nivel_data.get("puntaje", 0),
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
