from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from app.models.database import Base

class Rubrica(Base):
    """
    Rúbrica de evaluación creada por un profesor.
    Contiene múltiples criterios, cada uno con sus niveles de desempeño.
    """
    __tablename__ = "rubricas"

    id = Column(Integer, primary_key=True, index=True)
    profesor_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    nombre_rubrica = Column(String, nullable=False)
    descripcion = Column(Text)
    activo = Column(Boolean, default=True)

    # Relaciones
    profesor = relationship("Usuario", back_populates="rubricas")
    criterios = relationship("Criterio", back_populates="rubrica", cascade="all, delete-orphan",
                             order_by="Criterio.orden")
    evaluaciones = relationship("Evaluacion", back_populates="rubrica")


class Criterio(Base):
    """
    Criterio de evaluación dentro de una rúbrica.
    Ejemplo: "Planteamiento del Problema", "Metodología", etc.
    """
    __tablename__ = "criterios"

    id = Column(Integer, primary_key=True, index=True)
    rubrica_id = Column(Integer, ForeignKey("rubricas.id"), nullable=False)
    nombre_criterio = Column(String, nullable=False)
    descripcion_criterio = Column(Text)
    peso = Column(Float, nullable=False)  # Peso del criterio (0-1), ej: 0.15 = 15%
    orden = Column(Integer, default=0)

    # Relaciones
    rubrica = relationship("Rubrica", back_populates="criterios")
    niveles = relationship("Nivel", back_populates="criterio", cascade="all, delete-orphan", order_by="Nivel.orden")


class Nivel(Base):
    """
    Nivel de desempeño dentro de un criterio.
    Ejemplos: "Excelente" (3 pts), "Regular" (1-2 pts), "Insuficiente" (0 pts)
    """
    __tablename__ = "niveles"

    id = Column(Integer, primary_key=True, index=True)
    criterio_id = Column(Integer, ForeignKey("criterios.id"), nullable=False)
    nombre_nivel = Column(String, nullable=False)  # "Excelente", "Bueno", "Regular", "Insuficiente"
    puntaje_min = Column(Float, nullable=False)  # Puntaje mínimo del rango
    puntaje_max = Column(Float, nullable=False)  # Puntaje máximo del rango
    descriptores = Column(JSON)  # Lista de strings con los descriptores
    orden = Column(Integer, default=0)

    # Relación
    criterio = relationship("Criterio", back_populates="niveles")
