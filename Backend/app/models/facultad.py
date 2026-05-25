from sqlalchemy import Column, BigInteger, String
from app.config.database import Base


class Facultad(Base):

    __tablename__ = "facultad"
    __table_args__ = {"schema": "universidad"}

    id = Column(BigInteger, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
