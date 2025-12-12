from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship
import enum

from app.config.database import Base


class RolEnum(enum.Enum):
    PROFESOR = "PROFESOR"
    AREA_CALIDAD = "AREA_CALIDAD"


class Usuario(Base):

    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    nombre = Column(String, nullable=False)
    rol = Column(String, nullable=False)
    activo = Column(Boolean, default=True)

    rubricas = relationship("Rubrica", back_populates="profesor", cascade="all, delete-orphan")
    evaluaciones = relationship("Evaluacion", back_populates="profesor")