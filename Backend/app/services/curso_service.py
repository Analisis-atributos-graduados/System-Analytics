import logging
from typing import List
from sqlalchemy.orm import Session
from app.repositories.curso_repository import CursoRepository
from app.models import Curso
from app.schemas.curso_schemas import CursoCreate, CursoUpdate

log = logging.getLogger(__name__)


class CursoService:

    def __init__(self, db: Session):
        self.curso_repo = CursoRepository(db)

    def get_all_cursos(self) -> List[Curso]:
        return self.curso_repo.get_all()

    def get_cursos_habilitados(self) -> List[Curso]:
        return self.curso_repo.get_habilitados()

    def get_curso(self, curso_id: int) -> Curso:
        curso = self.curso_repo.get_by_id(curso_id)
        if not curso:
            raise ValueError(f"Curso {curso_id} no encontrado")
        return curso

    def create_curso(self, data: CursoCreate) -> Curso:
        existing = self.curso_repo.get_by_nombre(data.nombre)
        if existing:
            raise ValueError(f"Ya existe un curso con el nombre '{data.nombre}'")

        curso = Curso(
            nombre=data.nombre,
            habilitado=data.habilitado
        )
        return self.curso_repo.create(curso)

    def update_curso(self, curso_id: int, data: CursoUpdate) -> Curso:
        curso = self.get_curso(curso_id)

        if data.nombre is not None:
            existing = self.curso_repo.get_by_nombre(data.nombre)
            if existing and existing.id != curso_id:
                raise ValueError(f"Ya existe otro curso con el nombre '{data.nombre}'")

        update_data = data.dict(exclude_unset=True)
        updated_curso = self.curso_repo.update(curso_id, **update_data)
        
        if not updated_curso:
             raise ValueError(f"Error al actualizar curso {curso_id}")
             
        return updated_curso

    def delete_curso(self, curso_id: int) -> None:
        self.get_curso(curso_id)

        success = self.curso_repo.delete(curso_id)
        if not success:
            raise ValueError(f"No se pudo eliminar el curso {curso_id}")

    def toggle_habilitado(self, curso_id: int) -> Curso:
        curso = self.get_curso(curso_id)
        new_status = not curso.habilitado
        
        updated_curso = self.curso_repo.update(curso_id, habilitado=new_status)
        if not updated_curso:
            raise ValueError(f"Error al cambiar estado del curso {curso_id}")
            
        return updated_curso

    def bulk_assign_attributes(self, assignments: List[dict]) -> None:

        from app.models.curso_atributo import CursoAtributo

        self.curso_repo.db.query(CursoAtributo).delete()

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

        if assigned_course_ids:
            self.curso_repo.db.query(Curso).filter(Curso.id.in_(assigned_course_ids)).update(
                {Curso.habilitado: True}, synchronize_session=False
            )

            self.curso_repo.db.query(Curso).filter(Curso.id.notin_(assigned_course_ids)).update(
                {Curso.habilitado: False}, synchronize_session=False
            )
        else:
            self.curso_repo.db.query(Curso).update(
                {Curso.habilitado: False}, synchronize_session=False
            )
        
        self.curso_repo.db.commit()
