from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.config.database import get_db
from app.services.curso_service import CursoService
from app.schemas.curso_schemas import CursoSchema, CursoCreate, CursoUpdate, BulkAttributeAssignmentSchema
from app.config.dependencies import get_current_user, require_role
from app.models import Usuario

router = APIRouter(
    prefix="/cursos",
    tags=["Cursos"]
)

@router.get("/mis-cursos", response_model=List[CursoSchema])
def get_mis_cursos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    service = CursoService(db)
    if getattr(current_user, 'active_role', current_user.rol) == "PROFESOR":
        return service.get_cursos_by_profesor_email(current_user.email)
    else:
        return service.get_all_cursos()

@router.get("/{curso_id}/nrcs", response_model=List[int])
def get_nrcs_por_curso(
    curso_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    service = CursoService(db)
    if getattr(current_user, 'active_role', current_user.rol) == "PROFESOR":
        return service.get_nrcs_by_curso_and_profesor(curso_id, current_user.email)
    else:
        return service.get_nrcs_by_curso(curso_id)

@router.get("/nrc/{nrc_id}/alumnos", response_model=List[str])
def get_alumnos_por_nrc(
    nrc_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    from app.models.alumno import Alumno
    from app.models.alumno_nrc import AlumnoNrc
    
    try:
        alumnos = db.query(Alumno.nombres, Alumno.apellidos)\
            .join(AlumnoNrc, AlumnoNrc.id_alumno == Alumno.id)\
            .filter(AlumnoNrc.id_nrc == nrc_id)\
            .order_by(Alumno.apellidos, Alumno.nombres)\
            .all()
            
        return [f"{a.nombres} {a.apellidos}".strip() for a in alumnos]
    except Exception as e:
        log.error(f"Error al obtener alumnos del nrc {nrc_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.get("", response_model=List[CursoSchema])
def get_cursos(
    habilitados_only: bool = False,
    db: Session = Depends(get_db)
):

    service = CursoService(db)
    if habilitados_only:
        return service.get_cursos_habilitados()
    return service.get_all_cursos()

@router.post("", response_model=CursoSchema, status_code=status.HTTP_201_CREATED)
def create_curso(
    curso: CursoCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("DOCENTE_CIAC"))
):

    service = CursoService(db)
    try:
        return service.create_curso(curso)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{curso_id}", response_model=CursoSchema)
def update_curso(
    curso_id: int,
    curso: CursoUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("DOCENTE_CIAC"))
):

    service = CursoService(db)
    try:
        return service.update_curso(curso_id, curso)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.patch("/{curso_id}/toggle", response_model=CursoSchema)
def toggle_curso(
    curso_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("DOCENTE_CIAC"))
):

    service = CursoService(db)
    try:
        return service.toggle_habilitado(curso_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

@router.delete("/{curso_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_curso(
    curso_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("DOCENTE_CIAC"))
):

    service = CursoService(db)
    try:
        service.delete_curso(curso_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail="No se puede eliminar el curso (posiblemente tiene evaluaciones asociadas)")

@router.get("/mapping-status", status_code=status.HTTP_200_OK)
def get_mapping_status(
    db: Session = Depends(get_db),
    current_user = Depends(require_role("COMITE_ACADEMICO", "DOCENTE_CIAC", "PROFESOR"))
):
    from app.services.meta_porcentaje_service import MetaPorcentajeService
    from app.clients.supabase_client import SupabaseClient
    
    meta_service = MetaPorcentajeService(db)
    try:
        meta_data = meta_service.get_meta()
        supabase = SupabaseClient()
        relaciones = supabase.get_curso_ags()
        
        has_pending = any(not rel.get('aprobado', False) for rel in relaciones)
        estado = "pendiente" if (has_pending and relaciones) else "aprobado"
        
        return {
            "aprobado_mapping": estado,
            "meta": meta_data.porcentaje if meta_data else 80
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/approve-mapping", status_code=status.HTTP_200_OK)
def approve_mapping(
    current_user = Depends(require_role("DOCENTE_CIAC"))
):
    from app.clients.supabase_client import SupabaseClient
    try:
        supabase = SupabaseClient()
        success = supabase.approve_all_curso_ags()
        if not success:
            raise HTTPException(status_code=500, detail="Error al aprobar la asignación de cursos en Supabase.")
        return {"message": "Asignación de cursos aprobada correctamente sin cambios."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/assign-attributes", status_code=status.HTTP_200_OK)
def assign_attributes(
    payload: BulkAttributeAssignmentSchema,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("COMITE_ACADEMICO", "DOCENTE_CIAC"))
):
    import logging
    from app.services.meta_porcentaje_service import MetaPorcentajeService
    from app.schemas.meta_porcentaje_schemas import MetaPorcentajeUpdate

    log = logging.getLogger(__name__)
    curso_service = CursoService(db)
    meta_service = MetaPorcentajeService(db)

    aprobado = (getattr(current_user, 'active_role', current_user.rol) == "DOCENTE_CIAC")
    warnings = []

    try:
        curso_service.bulk_assign_attributes(
            assignments=[a.dict() for a in payload.asignaciones],
            aprobado=aprobado
        )
        log.info("Asignaciones de cursos guardadas en Supabase correctamente.")
    except Exception as e:
        log.error(f"Error crítico al guardar asignaciones en Supabase: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al guardar la asignación de cursos: {str(e)}"
        )

    try:
        update_data = MetaPorcentajeUpdate(porcentaje=payload.meta)
        meta_service.update_meta(update_data)
        log.info(f"Meta de aprobación actualizada a {payload.meta}% en Neon.")
    except Exception as e:

        log.warning(f"No se pudo actualizar la meta en Neon: {e}")
        warnings.append(f"Meta de aprobación no actualizada: {str(e)}")

    return {
        "message": "Asignación de cursos guardada correctamente." + (
            f" Advertencia: {'; '.join(warnings)}" if warnings else ""
        ),
        "aprobado_mapping": "aprobado" if aprobado else "pendiente",
        "warnings": warnings
    }
