import logging
from typing import List, Optional
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload
from app.models import Evaluacion, Curso
from app.repositories.base_repository import BaseRepository

log = logging.getLogger(__name__)


class EvaluacionRepository(BaseRepository):

    def __init__(self, db: Session):
        super().__init__(db, Evaluacion)

    def get_by_profesor(self, profesor_id: int) -> List[Evaluacion]:

        try:
            return (
                self.db.query(Evaluacion)
                .options(joinedload(Evaluacion.curso))
                .filter(Evaluacion.profesor_id == profesor_id)
                .order_by(Evaluacion.id.desc())
                .all()
            )
        except Exception as e:
            log.error(f"Error al obtener evaluaciones del profesor {profesor_id}: {e}")
            raise

    def get_all(self) -> List[Evaluacion]:
        try:
            return (
                self.db.query(Evaluacion)
                .options(joinedload(Evaluacion.curso))
                .order_by(Evaluacion.id.desc())
                .all()
            )
        except Exception as e:
            log.error(f"Error al obtener todas las evaluaciones: {e}")
            raise

    def get_with_resultados(self, evaluacion_id: int) -> Optional[Evaluacion]:

        try:
            return (
                self.db.query(Evaluacion)
                .options(
                    joinedload(Evaluacion.resultado_analisis),
                    joinedload(Evaluacion.archivos_procesados),
                    joinedload(Evaluacion.curso)
                )
                .filter(Evaluacion.id == evaluacion_id)
                .first()
            )
        except Exception as e:
            log.error(f"Error al obtener evaluación {evaluacion_id} con resultados: {e}")
            raise

    def get_with_details(self, evaluacion_id: int) -> Optional[Evaluacion]:
        return self.get_with_resultados(evaluacion_id)

    def get_by_filters(self, semestre: str = None, curso: str = None, tema: str = None, profesor_id: int = None) -> List[Evaluacion]:

        try:
            query = self.db.query(Evaluacion).options(
                joinedload(Evaluacion.resultado_analisis),
                joinedload(Evaluacion.archivos_procesados),
                joinedload(Evaluacion.curso)
            )

            if profesor_id:
                query = query.filter(Evaluacion.profesor_id == profesor_id)
            if semestre:
                query = query.filter(Evaluacion.semestre == semestre)
            if curso:
                if curso.isdigit():
                    query = query.filter(
                        or_(
                            Evaluacion.curso_id == int(curso),
                            Evaluacion.codigo_curso == curso
                        )
                    )
                else:

                    query = query.filter(
                        or_(
                            Evaluacion.codigo_curso == curso,
                            Evaluacion.curso.has(nombre=curso)
                        )
                    )
            if tema:
                query = query.filter(Evaluacion.tema == tema)

            results = query.order_by(Evaluacion.id.desc()).all()
            log.info(f"DEBUG: get_by_filters(semestre={semestre}, curso={curso}, tema={tema}, prof={profesor_id}) -> {len(results)} resultados")
            return results
        except Exception as e:
            log.error(f"Error al obtener evaluaciones por filtros: {e}")
            raise
