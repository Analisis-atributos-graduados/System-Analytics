from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from app.config.database import Base


class Curso(Base):
    """
    Representa un curso que puede ser habilitado/deshabilitado por el Área de Calidad.
    """
    __tablename__ = "cursos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)  # ej: "Cálculo Avanzado"
    habilitado = Column(Boolean, default=True, nullable=False)  # Controlado por Área de Calidad

    # Relaciones
    evaluaciones = relationship("Evaluacion", back_populates="curso")
