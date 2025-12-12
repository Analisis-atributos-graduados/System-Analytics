import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import distinct, or_

from app.models import get_db, Usuario, Evaluacion, Curso
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

        rol = str(current_user.rol) if hasattr(current_user.rol, 'value') else current_user.rol

        if rol == "PROFESOR":
            evaluaciones = evaluacion_repo.get_by_profesor(current_user.id)
        elif rol == "AREA_CALIDAD":
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


@router.get("/cursos")
async def get_cursos(
        semestre: str = Query(..., description="Semestre a filtrar"),
        current_user: Usuario = Depends(get_current_user),
        db: Session = Depends(get_db)
):

    try:
        rol = str(current_user.rol) if hasattr(current_user.rol, 'value') else current_user.rol

        subquery = db.query(distinct(Evaluacion.curso_id)).filter(Evaluacion.semestre == semestre)
        
        if rol == "PROFESOR":
            subquery = subquery.filter(Evaluacion.profesor_id == current_user.id)
            
        curso_ids = [r[0] for r in subquery.all()]

        from app.models.curso import Curso
        cursos_db = db.query(Curso).filter(Curso.id.in_(curso_ids)).all()
        
        cursos = []
        for c in cursos_db:
            attr_codes = [a.atributo_codigo for a in c.atributos]
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
        rol = str(current_user.rol) if hasattr(current_user.rol, 'value') else current_user.rol

        query = db.query(distinct(Evaluacion.tema)).join(Evaluacion.curso).filter(
            Evaluacion.semestre == semestre,
            or_(
                Evaluacion.codigo_curso == curso,
                Curso.nombre == curso
            )
        )

        if rol == "PROFESOR":
            query = query.filter(Evaluacion.profesor_id == current_user.id)

        temas = [t[0] for t in query.all() if t[0]]

        log.info(f"Temas para {semestre}/{curso}: {len(temas)}")
        return temas

    except Exception as e:
        log.error(f"Error al obtener temas: {e}")
        raise HTTPException(status_code=500, detail=str(e))
