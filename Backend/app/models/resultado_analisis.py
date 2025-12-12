from sqlalchemy import Column, Integer, Float, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.config.database import Base

class ResultadoAnalisis(Base):

    __tablename__ = "resultados_analisis"

    id = Column(Integer, primary_key=True, index=True)
    evaluacion_id = Column(Integer, ForeignKey("evaluaciones.id"), nullable=False, unique=True)

    criterios_evaluados = Column(JSON, nullable=True)

    nota_final = Column(Float, default=0.0)

    feedback_general = Column(Text)

    evaluacion = relationship("Evaluacion", back_populates="resultado_analisis")
