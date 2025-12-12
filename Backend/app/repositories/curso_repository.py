import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import Curso
from app.repositories.base_repository import BaseRepository

log = logging.getLogger(__name__)


class CursoRepository(BaseRepository):

    def __init__(self, db: Session):
        super().__init__(db, Curso)

    def get_by_nombre(self, nombre: str) -> Optional[Curso]:
        return self.db.query(Curso).filter(Curso.nombre == nombre).first()

    def get_habilitados(self) -> List[Curso]:
        return self.db.query(Curso).filter(Curso.habilitado == True).all()

    def get_all(self) -> List[Curso]:
        return self.db.query(Curso).all()
