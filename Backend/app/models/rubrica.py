from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from app.config.database import Base

class Rubrica(Base):

    __tablename__ = "rubricas"

    id = Column(Integer, primary_key=True, index=True)
    profesor_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    nombre_rubrica = Column(String, nullable=False)
    descripcion = Column(Text)
    activo = Column(Boolean, default=True)

    profesor = relationship("Usuario", back_populates="rubricas")
    criterios = relationship("Criterio", back_populates="rubrica", cascade="all, delete-orphan",
                             order_by="Criterio.orden")
    evaluaciones = relationship("Evaluacion", back_populates="rubrica")


class Criterio(Base):

    __tablename__ = "criterios"

    id = Column(Integer, primary_key=True, index=True)
    rubrica_id = Column(Integer, ForeignKey("rubricas.id"), nullable=False)
    nombre_criterio = Column(String, nullable=False)
    descripcion_criterio = Column(Text)
    peso = Column(Float, nullable=False)
    orden = Column(Integer, default=0)

    rubrica = relationship("Rubrica", back_populates="criterios")
    niveles = relationship("Nivel", back_populates="criterio", cascade="all, delete-orphan", order_by="Nivel.orden")


class Nivel(Base):

    __tablename__ = "niveles"

    id = Column(Integer, primary_key=True, index=True)
    criterio_id = Column(Integer, ForeignKey("criterios.id"), nullable=False)
    nombre_nivel = Column(String, nullable=False)
    puntaje_min = Column(Float, nullable=False)
    puntaje_max = Column(Float, nullable=False)
    descriptores = Column(JSON)
    orden = Column(Integer, default=0)

    criterio = relationship("Criterio", back_populates="niveles")
