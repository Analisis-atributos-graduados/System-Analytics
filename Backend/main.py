from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Depends
from sqlalchemy.orm import Session
import os
from database import MetadataArchivo, SessionLocal

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

# Dependencia para obtener sesión de base de datos
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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
    
    # Guardar archivo físicamente
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
    
    # Guardar metadata en base de datos
    metadata = MetadataArchivo(
        nombre_archivo=file.filename,
        nombre_curso=nombre_curso,
        codigo_curso=codigo_curso,
        instructor=instructor,
        semestre=semestre
    )
    db.add(metadata)
    db.commit()
    db.refresh(metadata)

    return {
        "message": "Archivo y metadata guardados correctamente",
        "filename": file.filename,
        "tipo": ALLOWED_TYPES[file.content_type],
        "metadata_id": metadata.id,
        "curso": nombre_curso,
        "codigo": codigo_curso,
        "instructor": instructor,
        "semestre": semestre
    }
