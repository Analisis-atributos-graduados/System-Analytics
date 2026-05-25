from sqlalchemy import Column, BigInteger, String, ForeignKey
from sqlalchemy.orm import relationship
from app.config.database import Base


class Escuela(Base):

    __tablename__ = "escuela"
    __table_args__ = {"schema": "universidad"}

    id = Column(BigInteger, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    facultad = Column(BigInteger, ForeignKey("universidad.facultad.id"))

    facultad_rel = relationship("Facultad", foreign_keys=[facultad])
