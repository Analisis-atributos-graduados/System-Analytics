from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime


class CriterioConfig(Base):
    __tablename__ = "criterios_config"

    id = Column(Integer, primary_key=True, index=True)
    aplicacion_conceptos = Column(Float, default=0.4)
    relacion_contextual = Column(Float, default=0.3)
    coherencia_logica = Column(Float, default=0.3)


class Evaluacion(Base):
    __tablename__ = "evaluaciones"

    id = Column(Integer, primary_key=True, index=True)
    nombre_alumno = Column(String, nullable=False)
    nombre_curso = Column(String)
    codigo_curso = Column(String)
    instructor = Column(String)
    semestre = Column(String)
    tema = Column(String)
    descripcion_tema = Column(Text)
    tipo_documento = Column(String, default="examen")
    fecha_creacion = Column(DateTime, default=datetime.datetime.utcnow)

    resultado_analisis = relationship("ResultadoAnalisis", back_populates="evaluacion", uselist=False)
    archivos_procesados = relationship("ArchivoProcesado", back_populates="evaluacion")


class ArchivoProcesado(Base):
    __tablename__ = "archivos_procesados"

    id = Column(Integer, primary_key=True, index=True)
    nombre_archivo_original = Column(String, nullable=False)
    texto_extraido = Column(Text)
    evaluacion_id = Column(Integer, ForeignKey("evaluaciones.id"), nullable=False)
    analisis_visual = Column(Text)
    evaluacion = relationship("Evaluacion", back_populates="archivos_procesados")


class ResultadoAnalisis(Base):
    __tablename__ = "resultados_analisis"

    id = Column(Integer, primary_key=True, index=True)
    evaluacion_id = Column(Integer, ForeignKey("evaluaciones.id"), nullable=False, unique=True)
    aplicacion_conceptos = Column(Float, default=0.0)
    relacion_contextual = Column(Float, default=0.0)
    coherencia_logica = Column(Float, default=0.0)
    nota_final = Column(Float, default=0.0)

    evaluacion = relationship("Evaluacion", back_populates="resultado_analisis")
