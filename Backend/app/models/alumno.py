from sqlalchemy import Column, BigInteger, String, Boolean
from app.config.database import Base

class Alumno(Base):
    __tablename__ = "alumno"
    __table_args__ = {"schema": "universidad"}

    id = Column("id_alumno", BigInteger, primary_key=True, index=True)
    nombres = Column(String, nullable=False)
    apellidos = Column(String, nullable=False)
    dni = Column(String, unique=True)
    correo = Column(String, unique=True, index=True)
    telefono = Column(String)
    activo = Column(Boolean, default=True)
