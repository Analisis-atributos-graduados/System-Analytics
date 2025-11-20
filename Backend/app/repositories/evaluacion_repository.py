import logging
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from app.models import Evaluacion
from app.repositories.base_repository import BaseRepository

log = logging.getLogger(__name__)


class EvaluacionRepository(BaseRepository):
    """
    Repositorio para operaciones con evaluaciones.
    """

    def __init__(self, db: Session):
        super().__init__(db, Evaluacion)

    def get_by_profesor(self, profesor_id: int) -> List[Evaluacion]:
        """Obtiene todas las evaluaciones de un profesor."""
        try:
            return (
                self.db.query(Evaluacion)
                .filter(Evaluacion.profesor_id == profesor_id)
                .order_by(Evaluacion.id.desc())
                .all()
            )
        except Exception as e:
            log.error(f"Error al obtener evaluaciones del profesor {profesor_id}: {e}")
            raise

    # ✅ MÉTODO AGREGADO
    def get_all(self) -> List[Evaluacion]:
        """Obtiene todas las evaluaciones (para AREA_CALIDAD)."""
        try:
            return (
                self.db.query(Evaluacion)
                .order_by(Evaluacion.id.desc())
                .all()
            )
        except Exception as e:
            log.error(f"Error al obtener todas las evaluaciones: {e}")
            raise

    def get_with_resultados(self, evaluacion_id: int) -> Optional[Evaluacion]:
        """Obtiene una evaluación con todos sus resultados."""
        try:
            return (
                self.db.query(Evaluacion)
                .options(
                    joinedload(Evaluacion.resultado_analisis),
                    joinedload(Evaluacion.archivos_procesados)
                )
                .filter(Evaluacion.id == evaluacion_id)
                .first()
            )
        except Exception as e:
            log.error(f"Error al obtener evaluación {evaluacion_id} con resultados: {e}")
            raise

    # ✅ MÉTODO AGREGADO
    def get_with_details(self, evaluacion_id: int) -> Optional[Evaluacion]:
        """
        Obtiene una evaluación con todos sus detalles (archivos, resultados).
        Alias de get_with_resultados para compatibilidad.
        """
        return self.get_with_resultados(evaluacion_id)
