from sqlalchemy import Column, Integer, String, ForeignKey
from app.config.database import Base

class CursoAtributo(Base):
    __tablename__ = "curso_atributos"

    curso_id = Column(Integer, ForeignKey("cursos.id"), primary_key=True)
    atributo_codigo = Column(String, primary_key=True)
