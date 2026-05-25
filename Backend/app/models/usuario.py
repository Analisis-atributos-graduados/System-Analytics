from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship
import enum

from app.config.database import Base


class RolEnum(enum.Enum):
    PROFESOR = "PROFESOR"
    DOCENTE_CIAC = "DOCENTE_CIAC"
    DIRECTOR_ESCUELA = "DIRECTOR_ESCUELA"
    COMITE_ACADEMICO = "COMITE_ACADEMICO"
    DIRAC = "DIRAC"
    ADMINISTRADOR = "ADMINISTRADOR"


class Usuario(Base):

    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    nombre = Column(String, nullable=False)
    rol = Column(String, nullable=False)
    activo = Column(Boolean, default=True)
    evaluaciones = relationship("Evaluacion", back_populates="profesor")

    @property
    def roles(self):
        if not self.rol:
            return []
        return [r.strip() for r in self.rol.split(",") if r.strip()]