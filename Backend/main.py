from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Body, Depends
from sqlalchemy.orm import Session
from database import SessionLocal, get_db
from models import MetadataArchivo, ResultadoOCR, CriterioConfig
from schemas import CriterioConfigUpdate
import os
import requests
import random

app = FastAPI(title="Análisis de datos")

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Tipos de archivos permitidos
ALLOWED_TYPES = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
    "text/plain": "Texto",
    "image/jpeg": "Imagen JPEG",
    "image/png": "Imagen PNG"
}

# Configuración del OCR API
OCR_URL = "https://pen-to-print-handwriting-ocr.p.rapidapi.com/recognize/"
OCR_HEADERS = {
    "x-rapidapi-key": "534727a65cmsh2c31c8f81ad2f4fp1b0fe0jsn273a4b72394e",
    "x-rapidapi-host": "pen-to-print-handwriting-ocr.p.rapidapi.com"
}


# ---------- Inicialización de criterios por defecto ----------
@app.on_event("startup")
def inicializar_criterios():
    db = SessionLocal()
    criterios_base = ["aplicacion_conceptos", "relacion_contextual", "coherencia_logica"]
    for nombre in criterios_base:
        if not db.query(CriterioConfig).filter_by(nombre=nombre).first():
            db.add(CriterioConfig(nombre=nombre, peso=1/3))  # pesos iguales por defecto
    db.commit()
    db.close()


# ---------- Endpoint: subir archivo + OCR ----------
@app.post("/upload/")
async def upload_file(
    file: UploadFile = File(...),
    nombre_curso: str = Form(...),
    codigo_curso: str = Form(...),
    instructor: str = Form(...),
    semestre: str = Form(...),
    db: Session = Depends(get_db)
):
    # Validar tipo de archivo
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido: {file.content_type}. "
                   f"Solo se aceptan: {', '.join(ALLOWED_TYPES.values())}."
        )

    # Guardar archivo en carpeta uploads
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    # Llamada a API OCR
    with open(file_path, "rb") as f:
        files = {"srcImg": f}
        response = requests.post(OCR_URL, headers=OCR_HEADERS, files=files)

    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="Error al procesar OCR")

    ocr_result = response.json().get("value", "")

    # Guardar en BD
    new_metadata = MetadataArchivo(
        nombre_curso=nombre_curso,
        codigo_curso=codigo_curso,
        instructor=instructor,
        semestre=semestre
    )
    db.add(new_metadata)
    db.commit()
    db.refresh(new_metadata)

    resultado_ocr = ResultadoOCR(
        tipo_archivo=ALLOWED_TYPES[file.content_type],
        texto_extraido=ocr_result,
        metadata=new_metadata
    )
    db.add(resultado_ocr)
    db.commit()

    return {
        "mensaje": "Archivo subido y analizado correctamente",
        "nombre_archivo": file.filename,
        "tipo_archivo": ALLOWED_TYPES[file.content_type],
        "texto_extraido": ocr_result
    }


# ---------- Endpoint: obtener criterios actuales ----------
@app.get("/criterios/")
def obtener_criterios(db: Session = Depends(get_db)):
    criterios = db.query(CriterioConfig).all()
    return [{"nombre": c.nombre, "peso": c.peso} for c in criterios]


# ---------- Endpoint: actualizar criterios ----------
@app.put("/criterios/")
def actualizar_criterios(criterios: CriterioConfigUpdate, db: Session = Depends(get_db)):
    # Validar suma de los pesos si quieres que sea igual a 1
    total = criterios.aplicacion_conceptos + criterios.relacion_contextual + criterios.coherencia_logica
    if total != 1.0:
        raise HTTPException(status_code=400, detail="La suma de los pesos debe ser 1.0")

    # Mapeo de nombres a valores
    criterios_dict = criterios.dict()

    for nombre, peso in criterios_dict.items():
        criterio = db.query(CriterioConfig).filter_by(nombre=nombre).first()
        if criterio:
            criterio.peso = peso
        else:
            db.add(CriterioConfig(nombre=nombre, peso=peso))

    db.commit()

    return {
        "mensaje": "Pesos actualizados correctamente",
        "criterios": criterios_dict
    }


# ---------- Endpoint: análisis con DeBERTa o simulación ----------
@app.post("/analizar/")
async def analizar_documento(
    texto: str = Body(..., embed=True),
    criterio: str = Body(None, embed=True),
    db: Session = Depends(get_db)
):
    # Simulación temporal del análisis
    resultados = {
        "aplicacion_conceptos": round(random.uniform(0.5, 1.0), 2),
        "relacion_contextual": round(random.uniform(0.5, 1.0), 2),
        "coherencia_logica": round(random.uniform(0.5, 1.0), 2)
    }

    # Obtener pesos desde BD
    pesos_db = db.query(CriterioConfig).all()
    pesos = {c.nombre: c.peso for c in pesos_db}
    total_peso = sum(pesos.values())
    pesos = {k: v / total_peso for k, v in pesos.items() if k in resultados}

    # Calcular puntaje global
    puntaje_global = sum(resultados[k] * pesos[k] for k in resultados)

    return {
        "analisis": resultados,
        "pesos_usados": pesos,
        "puntaje_global": round(puntaje_global, 2)
    }
