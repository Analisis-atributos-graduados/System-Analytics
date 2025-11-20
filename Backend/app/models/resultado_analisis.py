from sqlalchemy import Column, Integer, Float, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.models.database import Base

class ResultadoAnalisis(Base):
    """
    Almacena los resultados de la evaluación por criterios.
    AHORA: Usa criterios dinámicos basados en la rúbrica seleccionada.
    """
    __tablename__ = "resultados_analisis"

    id = Column(Integer, primary_key=True, index=True)
    evaluacion_id = Column(Integer, ForeignKey("evaluaciones.id"), nullable=False, unique=True)

    # ✅ CAMBIAR: Resultados por criterio (JSON dinámico)
    # Estructura: { "1": { "puntaje": 2.5, "nivel": "Bueno", "feedback": "..." }, "2": {...}, ... }
    # Donde las keys son los IDs de los criterios
    criterios_evaluados = Column(JSON, nullable=True)

    # Nota final
    nota_final = Column(Float, default=0.0)  # Escala 0-1 (se puede convertir a 0-20)

    # Feedback general
    feedback_general = Column(Text)

    # Relación
    evaluacion = relationship("Evaluacion", back_populates="resultado_analisis")
