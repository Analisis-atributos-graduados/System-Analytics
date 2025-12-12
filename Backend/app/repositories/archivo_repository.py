import logging
from typing import List
from sqlalchemy.orm import Session
from app.models import ArchivoProcesado
from app.repositories.base_repository import BaseRepository

log = logging.getLogger(__name__)


class ArchivoRepository(BaseRepository):

    def __init__(self, db: Session):
        super().__init__(db, ArchivoProcesado)

    def create_archivo(
            self,
            evaluacion_id: int,
            nombre_archivo_original: str,
            texto_extraido: str,
            analisis_visual: str = ""
    ) -> ArchivoProcesado:

        try:
            archivo = ArchivoProcesado(
                evaluacion_id=evaluacion_id,
                nombre_archivo_original=nombre_archivo_original,
                texto_extraido=texto_extraido,
                analisis_visual=analisis_visual
            )
            self.db.add(archivo)
            self.db.commit()
            self.db.refresh(archivo)

            log.info(f"Archivo procesado creado: ID={archivo.id}, nombre={nombre_archivo_original}")
            return archivo

        except Exception as e:
            log.error(f"Error al crear archivo procesado: {e}")
            self.db.rollback()
            raise

    def get_by_evaluacion(self, evaluacion_id: int) -> List[ArchivoProcesado]:

        try:
            return (
                self.db.query(ArchivoProcesado)
                .filter(ArchivoProcesado.evaluacion_id == evaluacion_id)
                .all()
            )
        except Exception as e:
            log.error(f"Error al obtener archivos de evaluación {evaluacion_id}: {e}")
            raise
