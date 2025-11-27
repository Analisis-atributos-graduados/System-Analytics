import logging
from typing import List, Optional
import io
import zipfile
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.models import get_db, Usuario, Evaluacion, Criterio
from app.schemas import (
    EvaluacionSchema,
    EvaluacionDetailSchema,
    ExamBatchRequest,
    QualityDashboardStats
)
from app.repositories import EvaluacionRepository
from app.services import OrchestratorService
from app.config.dependencies import get_orchestrator_service, get_current_user, require_role

log = logging.getLogger(__name__)

router = APIRouter(prefix="/evaluaciones", tags=["Evaluaciones"])


@router.get("/dashboard-stats")
async def get_dashboard_stats(
    semestre: str = Query(...),
    curso: str = Query(...),
    tema: str = Query(...),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtiene estadísticas agregadas para el dashboard.
    """
    try:
        repo = EvaluacionRepository(db)
        
        # Determinar ID del profesor para filtrar
        profesor_id = current_user.id if current_user.rol == "PROFESOR" else None
        
        # Obtener evaluaciones con resultados
        evaluaciones = repo.get_by_filters(
            semestre=semestre,
            curso=curso,
            tema=tema,
            profesor_id=profesor_id
        )

        if not evaluaciones:
            return {
                "general": {"total": 0, "promedio": 0, "aprobados": 0, "desaprobados": 0},
                "distribucion": {"0-4": 0, "5-8": 0, "9-12": 0, "13-16": 0, "17-20": 0},
                "criterios": [],
                "estudiantes": []
            }

        # Calcular estadísticas
        total = len(evaluaciones)
        notas = [e.resultado_analisis.nota_final for e in evaluaciones if e.resultado_analisis]
        promedio = sum(notas) / len(notas) if notas else 0
        aprobados = len([n for n in notas if n >= 10.5])
        desaprobados = total - aprobados

        # Distribución
        dist = {"0-4": 0, "5-8": 0, "9-12": 0, "13-16": 0, "17-20": 0}
        for n in notas:
            if n <= 4: dist["0-4"] += 1
            elif n <= 8: dist["5-8"] += 1
            elif n <= 12: dist["9-12"] += 1
            elif n <= 16: dist["13-16"] += 1
            else: dist["17-20"] += 1

        # Promedios por criterio
        criterios_stats = {}
        
        for ev in evaluaciones:
            if ev.resultado_analisis and ev.resultado_analisis.criterios_evaluados:
                criterios_json = ev.resultado_analisis.criterios_evaluados
                for crit_id, data in criterios_json.items():
                    if crit_id not in criterios_stats:
                        criterios_stats[crit_id] = {"sum": 0, "count": 0}
                    
                    criterios_stats[crit_id]["sum"] += data.get("puntaje", 0)
                    criterios_stats[crit_id]["count"] += 1

        # Enriquecer con nombres de criterios
        criterios_list = []
        if criterios_stats:
            # Separar IDs numéricos de nombres en texto
            ids = []
            names_stats = {}
            
            for k, v in criterios_stats.items():
                if str(k).isdigit():
                    ids.append(int(k))
                else:
                    names_stats[k] = v

            # Buscar criterios por ID
            db_criterios = []
            if ids:
                db_criterios = db.query(Criterio).filter(Criterio.id.in_(ids)).all()
            
            # Buscar criterios por Nombre (si hay claves de texto)
            if names_stats:
                names = list(names_stats.keys())
                # Podríamos filtrar por rubrica_id si tuviéramos acceso fácil, pero por nombre debería bastar para stats
                criterios_por_nombre = db.query(Criterio).filter(Criterio.nombre_criterio.in_(names)).all()
                db_criterios.extend(criterios_por_nombre)
            
            # Crear mapas de búsqueda
            crit_map = {str(c.id): c for c in db_criterios}
            crit_name_map = {c.nombre_criterio: c for c in db_criterios}

            # Procesar criterios por ID
            for crit_id in ids:
                stats = criterios_stats.get(str(crit_id)) or criterios_stats.get(crit_id)
                crit_obj = crit_map.get(str(crit_id))
                
                if crit_obj and stats:
                    promedio_crit = stats["sum"] / stats["count"]
                    
                    max_score = 0
                    if crit_obj.niveles:
                        max_score = max([n.puntaje_max for n in crit_obj.niveles])
                    
                    percentage = (promedio_crit / max_score * 100) if max_score > 0 else 0

                    criterios_list.append({
                        "nombre": crit_obj.nombre_criterio,
                        "promedio": round(promedio_crit, 2),
                        "porcentaje": round(percentage, 1)
                    })

            # Procesar criterios por Nombre (fallback para legacy o generados dinámicamente sin ID)
            for name, stats in names_stats.items():
                promedio_crit = stats["sum"] / stats["count"]
                
                # Intentar buscar max_score real por nombre
                max_score = 4.0 # Default
                if name in crit_name_map:
                    crit_obj = crit_name_map[name]
                    if crit_obj.niveles:
                        max_score = max([n.puntaje_max for n in crit_obj.niveles])
                elif promedio_crit > 4:
                    max_score = 20.0 # Si el promedio es alto, asumimos escala vigesimal

                percentage = (promedio_crit / max_score * 100)
                
                criterios_list.append({
                    "nombre": name,
                    "promedio": round(promedio_crit, 2),
                    "porcentaje": round(percentage, 1)
                })

        # Lista de estudiantes con detalles
        estudiantes = []
        for e in evaluaciones:
            student_data = {
                "id": e.id,
                "nombre": e.nombre_alumno,
                "nota": round(e.resultado_analisis.nota_final, 2) if e.resultado_analisis else 0,
                "fecha": e.fecha_creacion if hasattr(e, 'fecha_creacion') else None,
                "criterios": []
            }
            
            if e.resultado_analisis and e.resultado_analisis.criterios_evaluados:
                criterios_json = e.resultado_analisis.criterios_evaluados
                for key, data in criterios_json.items():
                    # Resolver nombre del criterio
                    nombre_crit = str(key)
                    max_score = 4.0 # Default
                    
                    # Intentar buscar en mapa de IDs
                    if str(key).isdigit() and str(key) in crit_map:
                        crit_obj = crit_map[str(key)]
                        nombre_crit = crit_obj.nombre_criterio
                        if crit_obj.niveles:
                            max_score = max([n.puntaje_max for n in crit_obj.niveles])
                    # Intentar buscar en mapa de Nombres
                    elif nombre_crit in crit_name_map:
                        crit_obj = crit_name_map[nombre_crit]
                        if crit_obj.niveles:
                            max_score = max([n.puntaje_max for n in crit_obj.niveles])
                    
                    puntaje = data.get("puntaje", 0)
                    percentage = (puntaje / max_score * 100) if max_score > 0 else 0
                    
                    student_data["criterios"].append({
                        "nombre": nombre_crit,
                        "puntaje": puntaje,
                        "porcentaje": round(percentage, 1),
                        "feedback": data.get("comentario") or data.get("feedback", "Sin comentarios")
                    })
            
            estudiantes.append(student_data)

        return {
            "general": {
                "total": total,
                "promedio": round(promedio, 2),
                "aprobados": aprobados,
                "desaprobados": desaprobados
            },
            "distribucion": dist,
            "criterios": criterios_list,
            "estudiantes": estudiantes,
            "tipo_documento": evaluaciones[0].tipo_documento if evaluaciones else "desconocido"
        }

    except Exception as e:
        log.error(f"Error en dashboard stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quality-dashboard-stats")
async def get_quality_dashboard_stats(
    semestre: str = Query(...),
    curso: Optional[str] = Query(None),
    current_user: Usuario = Depends(require_role("AREA_CALIDAD")),
    db: Session = Depends(get_db)
):
    """
    Obtiene estadísticas para el dashboard de calidad (AG-07).
    Agrega por curso (ignorando secciones) y usa buckets específicos.
    """
    try:
        repo = EvaluacionRepository(db)
        
        # 1. Obtener todas las evaluaciones del semestre
        # Si se especifica curso, intentamos filtrar por nombre si es posible, 
        # pero como el repo filtra por código/ID, mejor traemos todo y filtramos en memoria
        # para asegurar la agregación correcta por nombre de curso.
        evaluaciones = repo.get_by_filters(semestre=semestre)
        
        if not evaluaciones:
            return {
                "total_alumnos": 0,
                "porcentaje_logro": 0,
                "criterios": []
            }

        # 2. Filtrar por curso (Nombre) si se especifica
        if curso:
            # Normalizar para comparación
            curso_norm = curso.lower().strip()
            evaluaciones = [
                e for e in evaluaciones 
                if e.curso and e.curso.nombre.lower().strip() == curso_norm
            ]

        if not evaluaciones:
             return {
                "total_alumnos": 0,
                "porcentaje_logro": 0,
                "criterios": []
            }

        # 3. Calcular métricas (AG-07)
        # Buckets: Excelente (16-20), Bueno (11-15), Mejora (6-10), No Aceptable (0-5)
        buckets = {
            "excelente": 0,
            "bueno": 0,
            "requiereMejora": 0,
            "noAceptable": 0
        }
        
        total_alumnos = len(evaluaciones)
        
        for ev in evaluaciones:
            if ev.resultado_analisis:
                nota = ev.resultado_analisis.nota_final
                if nota >= 16:
                    buckets["excelente"] += 1
                elif nota >= 11:
                    buckets["bueno"] += 1
                elif nota >= 6:
                    buckets["requiereMejora"] += 1
                else:
                    buckets["noAceptable"] += 1
            else:
                # Si no tiene nota (pendiente), cuenta como no aceptable o se ignora?
                # Asumiremos que solo cuentan los evaluados.
                # Si queremos ser estrictos: buckets["noAceptable"] += 1
                # Pero mejor ignoramos los pendientes para no ensuciar la estadística
                total_alumnos -= 1

        if total_alumnos == 0:
             return {
                "total_alumnos": 0,
                "porcentaje_logro": 0,
                "criterios": []
            }

        # Porcentaje de logro: (Excelente + Bueno) / Total
        logro_count = buckets["excelente"] + buckets["bueno"]
        porcentaje_logro = (logro_count / total_alumnos) * 100

        # Estructura de respuesta (simulando un criterio único AG-07 por ahora)
        criterio_stats = {
            "codigo": "AG-07", # Hardcoded por requerimiento
            "excelente": buckets["excelente"],
            "bueno": buckets["bueno"],
            "requiereMejora": buckets["requiereMejora"],
            "noAceptable": buckets["noAceptable"]
        }

        return {
            "total_alumnos": total_alumnos,
            "porcentaje_logro": round(porcentaje_logro, 1),
            "criterios": [criterio_stats]
        }

    except Exception as e:
        log.error(f"Error en quality dashboard stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def download_transcriptions(
    semestre: str = Query(...),
    curso: str = Query(...),
    tema: str = Query(...),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Genera un ZIP con PDFs de las transcripciones de los exámenes.
    """
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
        from reportlab.lib.utils import simpleSplit

        repo = EvaluacionRepository(db)
        profesor_id = current_user.id if current_user.rol == "PROFESOR" else None
        
        evaluaciones = repo.get_by_filters(
            semestre=semestre,
            curso=curso,
            tema=tema,
            profesor_id=profesor_id
        )

        if not evaluaciones:
            raise HTTPException(status_code=404, detail="No se encontraron evaluaciones")

        # Crear ZIP en memoria
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            for ev in evaluaciones:
                # Obtener texto extraído
                texto = ""
                if ev.archivos_procesados:
                    # Concatenar texto de todos los archivos (usualmente es 1 examen)
                    texto = "\n\n".join([ap.texto_extraido or "" for ap in ev.archivos_procesados])
                
                if not texto:
                    texto = "(No se encontró texto transcrito para esta evaluación)"

                # Generar PDF en memoria
                pdf_buffer = io.BytesIO()
                c = canvas.Canvas(pdf_buffer, pagesize=letter)
                width, height = letter
                
                # Encabezado
                c.setFont("Helvetica-Bold", 12)
                c.drawString(50, height - 50, f"Transcripción - {ev.nombre_alumno}")
                c.setFont("Helvetica", 10)
                # ✅ CORREGIDO: Usar ev.curso.nombre en lugar de ev.nombre_curso
                nombre_curso = ev.curso.nombre if ev.curso else "Curso Desconocido"
                c.drawString(50, height - 70, f"Curso: {nombre_curso} | Tema: {ev.tema}")
                
                y_position = height - 100
                
                # Iterar sobre archivos procesados (páginas)
                if ev.archivos_procesados:
                    for idx, archivo in enumerate(ev.archivos_procesados, 1):
                        # Nueva página si falta espacio para el encabezado
                        if y_position < 100:
                            c.showPage()
                            y_position = height - 50
                            
                        # Encabezado de página
                        c.setFont("Helvetica-Bold", 11)
                        c.drawString(50, y_position, f"--- Página {idx} ---")
                        y_position -= 20
                        
                        c.setFont("Helvetica", 10)
                        texto = archivo.texto_extraido or "[Sin texto]"
                        
                        # Manejo de líneas respetando saltos de línea originales
                        lines = texto.split('\n')
                        for line in lines:
                            # Si la línea está vacía, solo avanzar cursor
                            if not line.strip():
                                y_position -= 12
                                continue
                                
                            # Dividir líneas muy largas pero respetando la estructura
                            wrapped_lines = simpleSplit(line, "Helvetica", 10, width - 100)
                            for wl in wrapped_lines:
                                # Nueva página si se acaba el espacio
                                if y_position < 50:
                                    c.showPage()
                                    y_position = height - 50
                                    
                                c.drawString(50, y_position, wl)
                                y_position -= 12
                        
                        y_position -= 20 # Espacio entre páginas
                else:
                    c.drawString(50, y_position, "(No se encontró texto transcrito para esta evaluación)")

                c.save()
                
                # Agregar PDF al ZIP
                filename = f"{ev.nombre_alumno.replace(' ', '_')}_transcripcion.pdf"
                zip_file.writestr(filename, pdf_buffer.getvalue())

        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename=transcripciones_{curso}_{tema}.zip"
            }
        )

    except Exception as e:
        log.error(f"Error generando transcripciones: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_evaluaciones(
    semestre: Optional[str] = Query(None),
    curso: Optional[str] = Query(None),
    tema: Optional[str] = Query(None),
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lista evaluaciones con filtros opcionales.
    Respeta permisos según rol.
    """
    try:
        repo = EvaluacionRepository(db)
        query = db.query(Evaluacion)

        # ✅ FIX: Manejar rol como string o enum
        rol = str(current_user.rol.value) if hasattr(current_user.rol, 'value') else str(current_user.rol)

        # Si es profesor, solo sus evaluaciones
        if rol == "PROFESOR":
            query = query.filter(Evaluacion.profesor_id == current_user.id)
        
        # Aplicar filtros
        if semestre:
            query = query.filter(Evaluacion.semestre == semestre)
        if curso:
            query = query.filter(Evaluacion.codigo_curso == curso)
        if tema:
            query = query.filter(Evaluacion.tema == tema)

        evaluaciones = query.all()

        log.info(f"Listadas {len(evaluaciones)} evaluaciones para {rol}")
        return evaluaciones

    except Exception as e:
        log.error(f"Error al listar evaluaciones: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{evaluacion_id}", response_model=EvaluacionDetailSchema)
async def get_evaluacion_detail(
    evaluacion_id: int,
    db: Session = Depends(get_db)
):
    """
    Obtiene detalles completos de una evaluación (con archivos y resultados).
    """
    try:
        repo = EvaluacionRepository(db)
        evaluacion = repo.get_with_details(evaluacion_id)

        if not evaluacion:
            raise HTTPException(status_code=404, detail="Evaluación no encontrada")

        log.info(f"Evaluación obtenida: ID={evaluacion_id}")
        return evaluacion

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error al obtener evaluación {evaluacion_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/enqueue-exam-batch")
async def enqueue_exam_batch(
    request: ExamBatchRequest,
    current_user: Usuario = Depends(require_role("PROFESOR")),
    orchestrator: OrchestratorService = Depends(get_orchestrator_service)
):
    """
    Orquestador principal: procesa un lote de exámenes o ensayos.
    Ahora requiere autenticación y usa rubrica_id.
    """
    try:
        log.info(f"Recibido lote de {current_user.nombre}: {len(request.pdf_files)} archivos")

        result = orchestrator.process_exam_batch(
            profesor_id=current_user.id,
            rubrica_id=request.rubrica_id,
            pdf_files=[f.dict() for f in request.pdf_files],
            student_list=request.student_list,
            curso_id=request.curso_id,  # ✅ CAMBIO: curso_id
            codigo_curso=request.codigo_curso,
            instructor=current_user.nombre,
            semestre=request.semestre,
            tema=request.tema,
            descripcion_tema=request.descripcion_tema or "",
            tipo_documento=request.tipo_documento
        )

        return result

    except Exception as e:
        log.error(f"Error en enqueue_exam_batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{evaluacion_id}")
async def delete_evaluacion(
    evaluacion_id: int,
    db: Session = Depends(get_db)
):
    """
    Elimina una evaluación (y sus archivos/resultados asociados por CASCADE).
    """
    try:
        repo = EvaluacionRepository(db)
        deleted = repo.delete(evaluacion_id)

        if not deleted:
            raise HTTPException(status_code=404, detail="Evaluación no encontrada")

        log.info(f"Evaluación eliminada: ID={evaluacion_id}")
        return {"success": True, "evaluacion_id": evaluacion_id}

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error al eliminar evaluación {evaluacion_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
