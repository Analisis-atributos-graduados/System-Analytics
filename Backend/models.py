from sqlalchemy import Column, Integer, String, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from database import Base


class Evaluacion(Base):
    __tablename__ = "evaluaciones"
    id = Column(Integer, primary_key=True, index=True)

    # Nuevo campo crucial para identificar al alumno
    nombre_alumno = Column(String, nullable=False, index=True)

    # El resto de los metadatos del curso
    nombre_curso = Column(String, nullable=False)
    codigo_curso = Column(String, nullable=False)
    instructor = Column(String, nullable=False)
    semestre = Column(String, nullable=False)
    tema = Column(String, nullable=False)
    descripcion_tema = Column(Text, nullable=True)

    # Relación uno-a-muchos: Una evaluación tiene muchos archivos procesados
    archivos_procesados = relationship("ArchivoProcesado", back_populates="evaluacion", cascade="all, delete-orphan")

    # Relación uno-a-uno: Una evaluación tiene un resultado de análisis final
    resultado_analisis = relationship("ResultadoAnalisis", back_populates="evaluacion", uselist=False,
                                      cascade="all, delete-orphan")


# Esta tabla ahora guarda la información de cada archivo individual (cada página del examen)
class ArchivoProcesado(Base):
    __tablename__ = "archivos_procesados"
    id = Column(Integer, primary_key=True, index=True)
    nombre_archivo_original = Column(String, nullable=False)
    texto_extraido = Column(Text, nullable=True)

    # Clave foránea para vincular este archivo a una evaluación
    evaluacion_id = Column(Integer, ForeignKey("evaluaciones.id"))

    # Relación inversa
    evaluacion = relationship("Evaluacion", back_populates="archivos_procesados")


# Esta tabla no cambia
class CriterioConfig(Base):
    __tablename__ = "criterios_config"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, unique=True, nullable=False)
    peso = Column(Float, nullable=False)


# El resultado final se asocia a la evaluación completa
class ResultadoAnalisis(Base):
    __tablename__ = "resultados_analisis"
    id = Column(Integer, primary_key=True, index=True)
    evaluacion_id = Column(Integer, ForeignKey("evaluaciones.id", ondelete="CASCADE"))
    aplicacion_conceptos = Column(Float, nullable=False)
    relacion_contextual = Column(Float, nullable=False)
    coherencia_logica = Column(Float, nullable=False)
    nota_final = Column(Float, nullable=False)

    evaluacion = relationship("Evaluacion", back_populates="resultado_analisis")

