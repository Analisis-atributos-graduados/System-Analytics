from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


class ArchivoProcesado(Base):
    __tablename__ = "archivos_procesados"

    id = Column(Integer, primary_key=True, index=True)
    nombre_archivo_original = Column(String, nullable=False)
    texto_extraido = Column(Text)
    evaluacion_id = Column(Integer, ForeignKey("evaluaciones.id"), nullable=False)
    analisis_visual = Column(Text)  # JSON serializado

    # Relación
    evaluacion = relationship("Evaluacion", back_populates="archivos_procesados")
