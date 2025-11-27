from sqlalchemy import Column, Integer
from app.config.database import Base


class MetaPorcentaje(Base):
    """
    Almacena el porcentaje objetivo global para evaluaciones.
    Tabla singleton - solo debe existir 1 registro.
    """
    __tablename__ = "meta_porcentaje"

    id = Column(Integer, primary_key=True, index=True)
    porcentaje = Column(Integer, nullable=False, default=80)  # Valor de 0-100
