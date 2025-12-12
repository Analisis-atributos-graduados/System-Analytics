from sqlalchemy import Column, Integer
from app.config.database import Base


class MetaPorcentaje(Base):

    __tablename__ = "meta_porcentaje"

    id = Column(Integer, primary_key=True, index=True)
    porcentaje = Column(Integer, nullable=False, default=80)
