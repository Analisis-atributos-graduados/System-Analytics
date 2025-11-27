import logging
from typing import List
from sqlalchemy.orm import Session
from app.repositories.curso_repository import CursoRepository
from app.models import Curso
from app.schemas.curso_schemas import CursoCreate, CursoUpdate

log = logging.getLogger(__name__)


class CursoService:
    """Service para gestión de cursos."""

    def __init__(self, db: Session):
        self.curso_repo = CursoRepository(db)

    def get_all_cursos(self) -> List[Curso]:
        """Obtiene todos los cursos."""
        return self.curso_repo.get_all()

    def get_cursos_habilitados(self) -> List[Curso]:
        """Obtiene solo los cursos habilitados."""
        return self.curso_repo.get_habilitados()

    def get_curso(self, curso_id: int) -> Curso:
        """Obtiene un curso por ID."""
        curso = self.curso_repo.get_by_id(curso_id)
        if not curso:
            raise ValueError(f"Curso {curso_id} no encontrado")
        return curso

    def create_curso(self, data: CursoCreate) -> Curso:
        """Crea un nuevo curso."""
        # Verificar si ya existe un curso con ese nombre
        existing = self.curso_repo.get_by_nombre(data.nombre)
        if existing:
            raise ValueError(f"Ya existe un curso con el nombre '{data.nombre}'")

        curso = Curso(
            nombre=data.nombre,
            habilitado=data.habilitado
        )
        return self.curso_repo.create(curso)

    def update_curso(self, curso_id: int, data: CursoUpdate) -> Curso:
        """Actualiza un curso."""
        curso = self.get_curso(curso_id)

        if data.nombre is not None:
            # Verificar que no exista otro curso con ese nombre
            existing = self.curso_repo.get_by_nombre(data.nombre)
            if existing and existing.id != curso_id:
                raise ValueError(f"Ya existe otro curso con el nombre '{data.nombre}'")
        
        # Preparar datos para actualización
        update_data = data.dict(exclude_unset=True)
        updated_curso = self.curso_repo.update(curso_id, **update_data)
        
        if not updated_curso:
             raise ValueError(f"Error al actualizar curso {curso_id}")
             
        return updated_curso

    def delete_curso(self, curso_id: int) -> None:
        """Elimina un curso."""
        # Verificar existencia
        self.get_curso(curso_id)
        
        # Nota: Esto fallará si hay evaluaciones asociadas (constraint FK)
        # El usuario debería deshabilitar en lugar de borrar
        success = self.curso_repo.delete(curso_id)
        if not success:
            raise ValueError(f"No se pudo eliminar el curso {curso_id}")

    def toggle_habilitado(self, curso_id: int) -> Curso:
        """Cambia el estado habilitado/deshabilitado."""
        curso = self.get_curso(curso_id)
        new_status = not curso.habilitado
        
        updated_curso = self.curso_repo.update(curso_id, habilitado=new_status)
        if not updated_curso:
            raise ValueError(f"Error al cambiar estado del curso {curso_id}")
            
        return updated_curso
