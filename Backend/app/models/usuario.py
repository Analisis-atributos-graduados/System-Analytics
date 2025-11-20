from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship
import enum

from .database import Base


class RolEnum(enum.Enum):
    PROFESOR = "PROFESOR"
    AREA_CALIDAD = "AREA_CALIDAD"


class Usuario(Base):
    """
    Tabla de usuarios del sistema (profesores y área de calidad)
    """
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    nombre = Column(String, nullable=False)
    rol = Column(String, nullable=False)  # 'PROFESOR' o 'AREA_CALIDAD'
    activo = Column(Boolean, default=True)

    # Relaciones
    rubricas = relationship("Rubrica", back_populates="profesor", cascade="all, delete-orphan")  # ✅ AGREGAR
    evaluaciones = relationship("Evaluacion", back_populates="profesor")