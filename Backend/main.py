from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Body, Depends
from sqlalchemy.orm import Session
from database import SessionLocal, get_db
from models import MetadataArchivo, ResultadoOCR, CriterioConfig
from schemas import CriterioConfigUpdate, AnalisisTextoRequest
import os
import requests
import torch
from transformers import pipeline

app = FastAPI(title="Análisis de datos")

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ---------- Configuración de tipos de archivos permitidos ----------
ALLOWED_TYPES = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
    "text/plain": "Texto",
    "image/jpeg": "Imagen JPEG",
    "image/png": "Imagen PNG"
}

# ---------- Configuración del OCR API ----------
OCR_URL = "https://pen-to-print-handwriting-ocr.p.rapidapi.com/recognize/"
OCR_HEADERS = {
    "x-rapidapi-key": "534727a65cmsh2c31c8f81ad2f4fp1b0fe0jsn273a4b72394e",
    "x-rapidapi-host": "pen-to-print-handwriting-ocr.p.rapidapi.com"
}

# ---------- Cargar modelo DeBERTa ----------
MODEL_NAME = "facebook/bart-large-mnli"
classifier = pipeline("zero-shot-classification", model=MODEL_NAME)

# ---------- Inicialización de criterios por defecto ----------
@app.on_event("startup")
def inicializar_criterios():
    db = SessionLocal()
    criterios_base = ["aplicacion_conceptos", "relacion_contextual", "coherencia_logica"]
    for nombre in criterios_base:
        if not db.query(CriterioConfig).filter_by(nombre=nombre).first():
            db.add(CriterioConfig(nombre=nombre, peso=1 / 3))
    db.commit()
    db.close()


# ---------- Función auxiliar: análisis con DeBERTa ----------
def analizar_texto(texto: str):
    etiquetas = [
        "aplicación de conceptos",
        "relación contextual",
        "coherencia lógica"
    ]
    resultado = classifier(texto, candidate_labels=etiquetas, multi_label=True)
    
    mapping = {
    "aplicación de conceptos": "aplicacion_conceptos",
    "relación contextual": "relacion_contextual",
    "coherencia lógica": "coherencia_logica"
    }

    return {
        mapping[etiquetas[i]]: round(resultado["scores"][i], 2)
        for i in range(len(etiquetas))
    }



# ---------- Endpoint: subir archivo + OCR ----------
@app.post("/upload/")
async def upload_file(
    file: UploadFile = File(...),
    nombre_curso: str = Form(...),
    codigo_curso: str = Form(...),
    instructor: str = Form(...),
    semestre: str = Form(...),
    tema: str = Form(...),
    descripcion_tema: str = Form(None),
    db: Session = Depends(get_db)
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido: {file.content_type}. "
                   f"Solo se aceptan: {', '.join(ALLOWED_TYPES.values())}."
        )

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    with open(file_path, "rb") as f:
        files = {"srcImg": f}
        response = requests.post(OCR_URL, headers=OCR_HEADERS, files=files)

    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="Error al procesar OCR")

    ocr_result = response.json().get("value", "")

    new_metadata = MetadataArchivo(
        nombre_curso=nombre_curso,
        codigo_curso=codigo_curso,
        instructor=instructor,
        semestre=semestre,
        tema=tema,
        descripcion_tema=descripcion_tema
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
    total = criterios.aplicacion_conceptos + criterios.relacion_contextual + criterios.coherencia_logica
    if total != 1.0:
        raise HTTPException(status_code=400, detail="La suma de los pesos debe ser 1.0")

    criterios_dict = criterios.dict()
    for nombre, peso in criterios_dict.items():
        criterio = db.query(CriterioConfig).filter_by(nombre=nombre).first()
        if criterio:
            criterio.peso = peso
        else:
            db.add(CriterioConfig(nombre=nombre, peso=peso))
    db.commit()

    return {"mensaje": "Pesos actualizados correctamente", "criterios": criterios_dict}


# ---------- Endpoint: análisis con DeBERTa ----------
@app.post("/analizar/")
async def analizar_documento(
    datos: AnalisisTextoRequest,  
    db: Session = Depends(get_db)
):
    texto = datos.texto  

    # Obtener pesos desde la base de datos
    criterios_db = db.query(CriterioConfig).all()
    pesos = {c.nombre: c.peso for c in criterios_db}

    # Análisis con DeBERTa
    resultados = analizar_texto(texto)

    # Calcular puntaje global ponderado
    total_peso = sum(pesos.values())
    pesos_normalizados = {k: v / total_peso for k, v in pesos.items() if k in resultados}
    puntaje_global = sum(resultados[k] * pesos_normalizados[k] for k in resultados if k in pesos_normalizados)

    return {
        "resultado": {
            "analisis": resultados,
            "puntaje_global": round(puntaje_global, 2)
        }
    }
