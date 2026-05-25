from sqlalchemy import Column, BigInteger, String
from app.config.database import Base

class Profesor(Base):
    __tablename__ = "profesor"
    __table_args__ = {"schema": "universidad"}

    id = Column("id_profesor", BigInteger, primary_key=True, index=True)
    nombres = Column(String, nullable=False)
    apellidos = Column(String, nullable=False)
    correo = Column(String, unique=True, nullable=False, index=True)
    dni = Column(String, unique=True)
    telefono = Column(String)
