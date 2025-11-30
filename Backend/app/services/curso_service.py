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

    def bulk_assign_attributes(self, assignments: List[dict]) -> None:
        """
        Asigna atributos a cursos en lote.
        Estrategia: Full Sync (Borrar todo y recrear).
        También actualiza el estado 'habilitado' de los cursos:
        - Asignado a algún atributo -> habilitado = True
        - No asignado a ningún atributo -> habilitado = False
        """
        from app.models.curso_atributo import CursoAtributo
        
        # 1. Limpiar todas las asignaciones existentes
        self.curso_repo.db.query(CursoAtributo).delete()
        
        # 2. Insertar nuevas asignaciones y recolectar IDs
        new_records = []
        assigned_course_ids = set()
        
        for assign in assignments:
            attr_code = assign['atributo']
            for curso_id in assign['cursos']:
                assigned_course_ids.add(curso_id)
                new_records.append(CursoAtributo(
                    curso_id=curso_id,
                    atributo_codigo=attr_code
                ))
        
        if new_records:
            self.curso_repo.db.add_all(new_records)
            
        # 3. Actualizar estado 'habilitado' de los cursos
        # Habilitar los que tienen asignación
        if assigned_course_ids:
            self.curso_repo.db.query(Curso).filter(Curso.id.in_(assigned_course_ids)).update(
                {Curso.habilitado: True}, synchronize_session=False
            )
            
            # Deshabilitar los que NO tienen asignación
            self.curso_repo.db.query(Curso).filter(Curso.id.notin_(assigned_course_ids)).update(
                {Curso.habilitado: False}, synchronize_session=False
            )
        else:
            # Si no hay asignaciones, deshabilitar todos
            self.curso_repo.db.query(Curso).update(
                {Curso.habilitado: False}, synchronize_session=False
            )
        
        self.curso_repo.db.commit()
