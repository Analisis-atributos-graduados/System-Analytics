from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.config.database import Base


class Evaluacion(Base):

    __tablename__ = "evaluaciones"

    id = Column(Integer, primary_key=True, index=True)
    profesor_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    rubrica_id = Column(Integer, ForeignKey("rubricas.id"), nullable=False)
    curso_id = Column(Integer, ForeignKey("cursos.id"), nullable=False)
    nombre_alumno = Column(String, nullable=False)

    codigo_curso = Column(String, index=True)
    instructor = Column(String)
    semestre = Column(String, index=True)
    tema = Column(String, index=True)
    descripcion_tema = Column(Text)
    tipo_documento = Column(String, default="examen")

    estado = Column(String, default="pendiente")

    profesor = relationship("Usuario", back_populates="evaluaciones")
    rubrica = relationship("Rubrica", back_populates="evaluaciones")
    curso = relationship("Curso", back_populates="evaluaciones")
    archivos_procesados = relationship("ArchivoProcesado", back_populates="evaluacion", cascade="all, delete-orphan")
    resultado_analisis = relationship("ResultadoAnalisis", back_populates="evaluacion", uselist=False,
                                      cascade="all, delete-orphan")
