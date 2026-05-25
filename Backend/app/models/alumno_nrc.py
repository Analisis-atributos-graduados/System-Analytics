from sqlalchemy import Column, BigInteger, String
from app.config.database import Base

class AlumnoNrc(Base):
    __tablename__ = "alumno_nrc"
    __table_args__ = {"schema": "universidad"}

    id = Column("id_alumno_nrc", BigInteger, primary_key=True, index=True)
    id_alumno = Column(BigInteger, nullable=False)
    id_nrc = Column(BigInteger, nullable=False)
    estado = Column(String)
    periodo = Column(String)
