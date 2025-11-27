from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.config.database import Base


class Evaluacion(Base):
    """
    Representa una evaluación individual de un alumno.
    """
    __tablename__ = "evaluaciones"

    id = Column(Integer, primary_key=True, index=True)
    profesor_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    rubrica_id = Column(Integer, ForeignKey("rubricas.id"), nullable=False)
    curso_id = Column(Integer, ForeignKey("cursos.id"), nullable=False)  # ✅ NUEVO: FK a Curso
    nombre_alumno = Column(String, nullable=False)

    # Datos del curso (mantener codigo_curso para secciones/horarios)
    codigo_curso = Column(String, index=True)  # ej: "3012-A", "3012-B"
    instructor = Column(String)
    semestre = Column(String, index=True)
    tema = Column(String, index=True)
    descripcion_tema = Column(Text)
    tipo_documento = Column(String, default="examen")  # "examen" o "ensayo/informe"

    # Estado del procesamiento
    estado = Column(String, default="pendiente")  # "pendiente", "procesando", "completado", "error"

    # Relaciones
    profesor = relationship("Usuario", back_populates="evaluaciones")
    rubrica = relationship("Rubrica", back_populates="evaluaciones")
    curso = relationship("Curso", back_populates="evaluaciones")  # ✅ NUEVO
    archivos_procesados = relationship("ArchivoProcesado", back_populates="evaluacion", cascade="all, delete-orphan")
    resultado_analisis = relationship("ResultadoAnalisis", back_populates="evaluacion", uselist=False,
                                      cascade="all, delete-orphan")
