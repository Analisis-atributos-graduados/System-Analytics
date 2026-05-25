from sqlalchemy import Column, Integer, String, BigInteger, ForeignKey
from sqlalchemy.orm import relationship
from app.config.database import Base


class Curso(Base):

    __tablename__ = "curso"
    __table_args__ = {"schema": "universidad"}

    id = Column("id_curso", BigInteger, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    creditos = Column(Integer)
    escuela = Column(BigInteger, ForeignKey("universidad.escuela.id"))

    escuela_rel = relationship("Escuela", foreign_keys=[escuela])

    evaluaciones = relationship(
        "Evaluacion",
        primaryjoin="Curso.id == Evaluacion.curso_id",
        foreign_keys="[Evaluacion.curso_id]",
        back_populates="curso"
    )


