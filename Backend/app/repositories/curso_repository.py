import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import Curso
from app.repositories.base_repository import BaseRepository

log = logging.getLogger(__name__)


class CursoRepository(BaseRepository):
    """
    Repositorio para operaciones con cursos.
    """

    def __init__(self, db: Session):
        super().__init__(db, Curso)

    def get_by_nombre(self, nombre: str) -> Optional[Curso]:
        """Obtiene un curso por su nombre."""
        return self.db.query(Curso).filter(Curso.nombre == nombre).first()

    def get_habilitados(self) -> List[Curso]:
        """Obtiene todos los cursos habilitados."""
        return self.db.query(Curso).filter(Curso.habilitado == True).all()

    def get_all(self) -> List[Curso]:
        """Obtiene todos los cursos (habilitados y deshabilitados)."""
        return self.db.query(Curso).all()
