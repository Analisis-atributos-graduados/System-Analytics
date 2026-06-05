import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import distinct, or_

from app.models import get_db, Usuario, Evaluacion, Curso, Facultad, Escuela
from app.config.dependencies import get_current_user
from app.repositories import EvaluacionRepository

log = logging.getLogger(__name__)

router = APIRouter(prefix="/filtros", tags=["Filtros"])


@router.get("/semestres", response_model=List[str])
async def get_semestres(
        current_user: Usuario = Depends(get_current_user),
        db: Session = Depends(get_db)
):

    try:
        evaluacion_repo = EvaluacionRepository(db)

        rol = getattr(current_user, 'active_role', current_user.rol)

        if rol == "PROFESOR":
            evaluaciones = evaluacion_repo.get_by_profesor(current_user.id)
        elif rol in ["DOCENTE_CIAC", "DIRECTOR_ESCUELA", "COMITE_ACADEMICO", "DIRAC", "ADMINISTRADOR"]:
            evaluaciones = evaluacion_repo.get_all()
        else:
            raise HTTPException(status_code=403, detail="Rol no autorizado")

        semestres = sorted(list(set(
            ev.semestre for ev in evaluaciones if ev.semestre
        )), reverse=True)

        log.info(f"Semestres encontrados para {current_user.nombre}: {semestres}")
        return semestres

    except Exception as e:
        log.error(f"Error al obtener semestres: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/facultades", response_model=List[dict])
async def get_facultades(
        current_user: Usuario = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    try:
        rol = getattr(current_user, 'active_role', current_user.rol)
        if rol not in ["DIRAC", "ADMINISTRADOR"]:
            raise HTTPException(status_code=403, detail="Rol no autorizado")
        facultades = db.query(Facultad).order_by(Facultad.nombre.asc()).all()
        return [{"id": f.id, "nombre": f.nombre} for f in facultades]
    except Exception as e:
        log.error(f"Error al obtener facultades: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/escuelas", response_model=List[dict])
async def get_escuelas(
        facultad_id: Optional[int] = Query(None, description="Filtrar por facultad"),
        current_user: Usuario = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    try:
        rol = getattr(current_user, 'active_role', current_user.rol)
        if rol not in ["DIRAC", "ADMINISTRADOR"]:
            raise HTTPException(status_code=403, detail="Rol no autorizado")
        query = db.query(Escuela)
        if facultad_id is not None:
            query = query.filter(Escuela.facultad == facultad_id)
        escuelas = query.order_by(Escuela.nombre.asc()).all()
        return [{"id": e.id, "nombre": e.nombre, "facultad_id": e.facultad} for e in escuelas]
    except Exception as e:
        log.error(f"Error al obtener escuelas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cursos")
async def get_cursos(
        semestre: str = Query(..., description="Semestre a filtrar"),
        escuela_id: Optional[int] = Query(None, description="Filtrar por escuela"),
        current_user: Usuario = Depends(get_current_user),
        db: Session = Depends(get_db)
):

    try:
        rol = getattr(current_user, 'active_role', current_user.rol)

        subquery = db.query(distinct(Evaluacion.curso_id)).filter(Evaluacion.semestre == semestre)
        
        if rol == "PROFESOR":
            subquery = subquery.filter(Evaluacion.profesor_id == current_user.id)
            
            from app.models.profesor import Profesor
            from app.models.nrc import Nrc
            profesor = db.query(Profesor).filter(Profesor.correo == current_user.email).first()
            if profesor:
                assigned_ids_query = db.query(distinct(Nrc.id_curso)).filter(Nrc.id_profesor == profesor.id).all()
                assigned_curso_ids = [row[0] for row in assigned_ids_query if row[0] is not None]
                subquery = subquery.filter(Evaluacion.curso_id.in_(assigned_curso_ids))
            else:
                return []
            
        curso_ids = [r[0] for r in subquery.all()]

        from app.models.curso import Curso
        query_cursos = db.query(Curso).filter(Curso.id.in_(curso_ids))
        if escuela_id is not None:
            query_cursos = query_cursos.filter(Curso.escuela == escuela_id)
        cursos_db = query_cursos.all()
        
        from app.clients.supabase_client import SupabaseClient
        try:
            supabase = SupabaseClient()
            supabase_relaciones = supabase.get_curso_ags()
        except Exception as e:
            log.error(f"Error al obtener curso_ag de Supabase: {e}")
            supabase_relaciones = []

        relaciones_por_curso = {}
        for rel in supabase_relaciones:
            id_curso = rel.get('id_curso')
            id_ag = rel.get('id_ag')
            if id_curso and id_ag:
                if id_curso not in relaciones_por_curso:
                    relaciones_por_curso[id_curso] = []
                relaciones_por_curso[id_curso].append(f"AG-{str(id_ag).zfill(2)}")

        cursos = []
        for c in cursos_db:
            attr_codes = relaciones_por_curso.get(c.id, [])
            cursos.append({
                "codigo": c.nombre,
                "nombre": c.nombre,
                "atributos": attr_codes
            })

        log.info(f"Cursos para semestre {semestre}: {len(cursos)}")
        return cursos

    except Exception as e:
        log.error(f"Error al obtener cursos: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/temas")
async def get_temas(
        semestre: str = Query(..., description="Semestre a filtrar"),
        curso: str = Query(..., description="Código del curso a filtrar"),
        current_user: Usuario = Depends(get_current_user),
        db: Session = Depends(get_db)
):

    try:
        rol = getattr(current_user, 'active_role', current_user.rol)

        if curso.isdigit():
            curso_int = int(curso)
            query = db.query(distinct(Evaluacion.tema)).filter(
                Evaluacion.semestre == semestre,
                or_(
                    Evaluacion.codigo_curso == curso_int,
                    Evaluacion.curso_id == curso_int
                )
            )
        else:
            query = db.query(distinct(Evaluacion.tema)).join(Evaluacion.curso).filter(
                Evaluacion.semestre == semestre,
                Curso.nombre == curso
            )

        if rol == "PROFESOR":
            query = query.filter(Evaluacion.profesor_id == current_user.id)

        temas = [t[0] for t in query.all() if t[0]]

        log.info(f"Temas para {semestre}/{curso}: {len(temas)}")
        return temas

    except Exception as e:
        log.error(f"Error al obtener temas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/nrcs")
async def get_nrcs(
        semestre: str = Query(..., description="Semestre a filtrar"),
        curso: str = Query(..., description="Nombre del curso a filtrar"),
        current_user: Usuario = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    try:
        rol = getattr(current_user, 'active_role', current_user.rol)

        from app.models.curso import Curso
        cursos_db = db.query(Curso).filter(Curso.nombre == curso).all()
        if not cursos_db:
            return []
        curso_ids = [c.id for c in cursos_db]

        query = db.query(distinct(Evaluacion.codigo_curso)).filter(
            Evaluacion.semestre == semestre,
            Evaluacion.curso_id.in_(curso_ids)
        )

        if rol == "PROFESOR":
            query = query.filter(Evaluacion.profesor_id == current_user.id)

        nrcs = [r[0] for r in query.all() if r[0] is not None]
        log.info(f"NRCs para {semestre}/{curso}: {nrcs}")
        return sorted(nrcs)

    except Exception as e:
        log.error(f"Error al obtener nrcs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

