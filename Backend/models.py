from sqlalchemy import Column, Integer, String, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from database import Base

class MetadataArchivo(Base):
    __tablename__ = "metadata_archivos"
    id = Column(Integer, primary_key=True, index=True)
    nombre_curso = Column(String, nullable=False)
    codigo_curso = Column(String, nullable=False)
    instructor = Column(String, nullable=False)
    semestre = Column(String, nullable=False)
    tema = Column(String, nullable=False)
    descripcion_tema = Column(Text, nullable=True)

    # Relación uno a muchos
    resultados = relationship("ResultadoOCR", back_populates="archivo_metadata")


class ResultadoOCR(Base):
    __tablename__ = "resultado_ocr"
    id = Column(Integer, primary_key=True, index=True)
    tipo_archivo = Column(String, nullable=False)
    texto_extraido = Column(Text, nullable=True)
    metadata_id = Column(Integer, ForeignKey("metadata_archivos.id"))

    # Relación inversa
    archivo_metadata = relationship("MetadataArchivo", back_populates="resultados")

class CriterioConfig(Base):
    __tablename__ = "criterios_config"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, unique=True, nullable=False)
    peso = Column(Float, nullable=False)
