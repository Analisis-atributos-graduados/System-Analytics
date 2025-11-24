import logging
import json
from sqlalchemy.orm import Session
from app.models import ResultadoAnalisis
from app.repositories.base_repository import BaseRepository

log = logging.getLogger(__name__)


class ResultadoRepository(BaseRepository):
    """Repositorio para operaciones con resultados de análisis."""

    def __init__(self, db: Session):
        super().__init__(db, ResultadoAnalisis)

    def create(
            self,
            evaluacion_id: int,
            criterios_json: dict,
            nota_final: float
    ) -> ResultadoAnalisis:
        """
        Crea un resultado de análisis con criterios dinámicos.

        Args:
            evaluacion_id: ID de la evaluación
            criterios_json: Dict con resultados por criterio
                Estructura: {
                    "Aplicación conceptos": {
                        "score": 0.85,
                        "confidence": 0.92,
                        "nivel": "Excelente",
                        "peso": 0.33
                    },
                    ...
                }
            nota_final: Nota final ponderada (0-1)

        Returns:
            ResultadoAnalisis creado
        """
        try:
            # ✅ Convertir estructura para guardar en JSON
            # Estructura esperada en DB: {"nombre_criterio": {"puntaje": X, "nivel": Y, ...}}
            criterios_evaluados = {}

            for nombre_criterio, datos in criterios_json.items():
                criterios_evaluados[nombre_criterio] = {
                    "puntaje": datos.get('score', 0.0),  # Score 0-1
                    "nivel": datos.get('nivel', 'Regular'),
                    "confidence": datos.get('confidence', 0.0),
                    "peso": datos.get('peso', 0.0),
                    "comentario": datos.get('feedback', '')  # ✅ Agregado feedback por criterio
                }

            # Crear resultado
            resultado = ResultadoAnalisis(
                evaluacion_id=evaluacion_id,
                criterios_evaluados=criterios_evaluados,  # ✅ JSON dinámico
                nota_final=nota_final,
                feedback_general=""  # Se puede agregar después
            )

            self.db.add(resultado)
            self.db.commit()
            self.db.refresh(resultado)

            log.info(f"✅ Resultado creado: ID={resultado.id}, Nota={nota_final:.3f}")
            return resultado

        except Exception as e:
            log.error(f"Error al crear resultado: {e}")
            self.db.rollback()
            raise

    def get_by_evaluacion(self, evaluacion_id: int) -> ResultadoAnalisis:
        """Obtiene el resultado de una evaluación."""
        try:
            return (
                self.db.query(ResultadoAnalisis)
                .filter(ResultadoAnalisis.evaluacion_id == evaluacion_id)
                .first()
            )
        except Exception as e:
            log.error(f"Error al obtener resultado de evaluación {evaluacion_id}: {e}")
            raise

    def update_feedback(
            self,
            resultado_id: int,
            feedback_general: str
    ) -> ResultadoAnalisis:
        """Actualiza el feedback general de un resultado."""
        try:
            resultado = self.get_by_id(resultado_id)
            if not resultado:
                raise ValueError(f"Resultado {resultado_id} no encontrado")

            resultado.feedback_general = feedback_general
            self.db.commit()
            self.db.refresh(resultado)

            log.info(f"Feedback actualizado para resultado {resultado_id}")
            return resultado

        except Exception as e:
            log.error(f"Error al actualizar feedback: {e}")
            self.db.rollback()
            raise
