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

    def get_all_cursos(self) -> List[dict]:
        from app.clients.supabase_client import SupabaseClient
        
        try:
            supabase = SupabaseClient()
            supabase_cursos = supabase.get_cursos()
            supabase_relaciones = supabase.get_curso_ags()
            
            relaciones_por_curso = {}
            for rel in supabase_relaciones:
                id_curso = rel.get('id_curso')
                id_ag = rel.get('id_ag')
                if id_curso and id_ag:
                    if id_curso not in relaciones_por_curso:
                        relaciones_por_curso[id_curso] = []
                    relaciones_por_curso[id_curso].append(f"AG-{str(id_ag).zfill(2)}")
            
            result = []
            for s_curso in supabase_cursos:
                id_curso = s_curso.get('id_curso')
                nombre = s_curso.get('nombre')
                if not id_curso or not nombre:
                    continue
                
                atributos_codigos = relaciones_por_curso.get(id_curso, [])
                habilitado = len(atributos_codigos) > 0
                
                result.append({
                    "id": id_curso,
                    "nombre": nombre,
                    "habilitado": habilitado,
                    "atributos": [{"atributo_codigo": code} for code in atributos_codigos]
                })
            
            return result
        except Exception as e:
            log.error(f"CursoService.get_all_cursos: Error al obtener datos directamente de Supabase: {e}")
            return []

    def get_cursos_habilitados(self) -> List[dict]:
        todos = self.get_all_cursos()
        return [c for c in todos if c.get("habilitado") is True]

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
            nombre=data.nombre
        )
        return self.curso_repo.create(curso)

    def update_curso(self, curso_id: int, data: CursoUpdate) -> Curso:
        curso = self.get_curso(curso_id)

        if data.nombre is not None:
            existing = self.curso_repo.get_by_nombre(data.nombre)
            if existing and existing.id != curso_id:
                raise ValueError(f"Ya existe otro curso con el nombre '{data.nombre}'")

        update_data = data.dict(exclude_unset=True)
        if "habilitado" in update_data:
            del update_data["habilitado"]
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
        raise NotImplementedError("El estado habilitado de un curso se maneja a través de su asignación de atributos en Supabase.")

    def bulk_assign_attributes(self, assignments: List[dict], aprobado: bool = False) -> None:
        import logging
        from app.clients.supabase_client import SupabaseClient

        log = logging.getLogger(__name__)

        supabase = SupabaseClient()
        new_mappings = []
        assigned_course_ids = set()

        for assign in assignments:
            attr_code = assign['atributo']
            try:
                id_ag = int(attr_code.split('-')[1])
            except Exception:
                continue

            for curso_id in assign['cursos']:
                assigned_course_ids.add(curso_id)
                new_mappings.append({
                    "id_curso": curso_id,
                    "id_ag": id_ag,
                    "aprobado": aprobado
                })

        supabase.delete_all_curso_ags()
        if new_mappings:
            supabase.insert_curso_ags(new_mappings)
        log.info(f"Supabase: {len(new_mappings)} relaciones curso-AG guardadas.")

        pass


    def get_cursos_by_profesor_email(self, email: str) -> List[dict]:

        from app.models.profesor import Profesor
        from app.models.nrc import Nrc
        from sqlalchemy import distinct
        
        try:
            profesor = self.curso_repo.db.query(Profesor).filter(Profesor.correo == email).first()
            if not profesor:
                log.warning(f"CursoService.get_cursos_by_profesor_email: Profesor con correo {email} no encontrado")
                return []
                
            curso_ids_query = self.curso_repo.db.query(distinct(Nrc.id_curso)).filter(Nrc.id_profesor == profesor.id).all()
            curso_ids = [row[0] for row in curso_ids_query if row[0] is not None]
            
            if not curso_ids:
                return []
                
            cursos_db = self.curso_repo.db.query(Curso).filter(Curso.id.in_(curso_ids)).all()
            
            from app.clients.supabase_client import SupabaseClient
            try:
                supabase = SupabaseClient()
                supabase_relaciones = supabase.get_curso_ags()
            except Exception as e:
                log.error(f"CursoService.get_cursos_by_profesor_email: Error al obtener curso_ag de Supabase: {e}")
                supabase_relaciones = []

            relaciones_por_curso = {}
            for rel in supabase_relaciones:
                id_curso = rel.get('id_curso')
                id_ag = rel.get('id_ag')
                if id_curso and id_ag:
                    if id_curso not in relaciones_por_curso:
                        relaciones_por_curso[id_curso] = []
                    relaciones_por_curso[id_curso].append(f"AG-{str(id_ag).zfill(2)}")

            result = []
            for c in cursos_db:
                atributos_codigos = relaciones_por_curso.get(c.id, [])
                result.append({
                    "id": c.id,
                    "nombre": c.nombre,
                    "habilitado": True,
                    "atributos": [{"atributo_codigo": code} for code in atributos_codigos]
                })
            return result
        except Exception as e:
            log.error(f"CursoService.get_cursos_by_profesor_email: Error al obtener cursos: {e}")
            return []

    def get_nrcs_by_curso_and_profesor(self, curso_id: int, email: str) -> List[int]:

        from app.models.profesor import Profesor
        from app.models.nrc import Nrc
        
        try:
            profesor = self.curso_repo.db.query(Profesor).filter(Profesor.correo == email).first()
            if not profesor:
                log.warning(f"CursoService.get_nrcs_by_curso_and_profesor: Profesor con correo {email} no encontrado")
                return []
                
            nrcs_db = self.curso_repo.db.query(Nrc.id).filter(
                Nrc.id_curso == curso_id,
                Nrc.id_profesor == profesor.id
            ).all()
            
            return [row[0] for row in nrcs_db if row[0] is not None]
        except Exception as e:
            log.error(f"CursoService.get_nrcs_by_curso_and_profesor: Error al obtener NRCs: {e}")
            return []

    def get_nrcs_by_curso(self, curso_id: int) -> List[int]:

        from app.models.nrc import Nrc
        try:
            nrcs_db = self.curso_repo.db.query(Nrc.id).filter(Nrc.id_curso == curso_id).all()
            return [row[0] for row in nrcs_db if row[0] is not None]
        except Exception as e:
            log.error(f"CursoService.get_nrcs_by_curso: Error al obtener NRCs: {e}")
            return []

