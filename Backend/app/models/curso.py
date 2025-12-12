from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from app.config.database import Base


class Curso(Base):

    __tablename__ = "cursos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    habilitado = Column(Boolean, default=True, nullable=False)

    evaluaciones = relationship("Evaluacion", back_populates="curso")
    atributos = relationship("CursoAtributo", backref="curso", cascade="all, delete-orphan")
