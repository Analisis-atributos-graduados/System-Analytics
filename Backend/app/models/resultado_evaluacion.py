from sqlalchemy import Column, Integer, Text
from sqlalchemy.orm import relationship
from app.config.database import Base

class ResultadoEvaluacion(Base):

    __tablename__ = "resultados_evaluacion"

    id = Column(Integer, primary_key=True, index=True)
    hallazgos = Column(Text, nullable=True)
    fortalezas = Column(Text, nullable=True)
    oportunidades = Column(Text, nullable=True)

    resultados_analisis = relationship("ResultadoAnalisis", back_populates="resultado_evaluacion")
