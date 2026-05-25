from sqlalchemy import Column, BigInteger, String
from app.config.database import Base

class Nrc(Base):
    __tablename__ = "nrc"
    __table_args__ = {"schema": "universidad"}

    id = Column("id_nrc", BigInteger, primary_key=True, index=True)
    id_curso = Column(BigInteger, nullable=False)
    id_profesor = Column(BigInteger, nullable=False)
    aula = Column(String)
    tipo = Column(String)
