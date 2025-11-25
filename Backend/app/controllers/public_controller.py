import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.models import get_db
from app.schemas import GenerateUploadURLRequest
from app.clients import GCSClient
from app.config.dependencies import get_gcs_client
from app.extractors.text_extractor import TextExtractor
from fastapi import Form

log = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Public"])


@router.get("/")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "analitica-backend",
        "version": "2.0.0"
    }


@router.post("/generate-upload-url")
async def generate_upload_url(
        request: GenerateUploadURLRequest,
        gcs_client: GCSClient = Depends(get_gcs_client)
):
    """
    Genera una URL firmada v4 para que el cliente suba directamente a GCS.

    El cliente debe hacer PUT a la URL con el archivo.
    """
    try:
        # Generar nombre único para el archivo
        unique_filename = f"{uuid.uuid4()}_{request.filename}"

        # Generar URL firmada
        result = gcs_client.generate_signed_upload_url(
            filename=unique_filename,
            content_type=request.content_type,
            expiration_minutes=15
        )

        log.info(f"URL de subida generada: {unique_filename}")

        return {
            "upload_url": result['upload_url'],
            "gcs_filename": result['gcs_filename']
        }

    except Exception as e:
        log.error(f"Error al generar URL de subida: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-file-proxy")
async def upload_file_proxy(
        file: UploadFile = File(...),
        tipo_documento: str = Form(None),
        gcs_client: GCSClient = Depends(get_gcs_client)
):
    """
    Proxy alternativo para subir archivos directamente al backend.
    El backend sube el archivo a GCS.
    """
    try:
        # Leer archivo
        file_bytes = await file.read()
        file_extension = f".{file.filename.split('.')[-1].lower()}" if '.' in file.filename else ''

        # ✅ VALIDACIÓN DE CONTENIDO
        if tipo_documento:
            text_extractor = TextExtractor()
            has_text = text_extractor.detect_has_extractable_text(file_bytes, file_extension)

            if tipo_documento == 'examen':
                # Exámenes manuscritos NO deben tener texto extraíble (son escaneos)
                if has_text:
                    raise HTTPException(
                        status_code=400,
                        detail=f"El archivo {file.filename} parece ser un documento de texto digital. Para exámenes manuscritos, sube imágenes o escaneos sin texto seleccionable."
                    )
            elif tipo_documento == 'ensayo/informe':
                # Ensayos DEBEN tener texto extraíble
                if not has_text:
                    raise HTTPException(
                        status_code=400,
                        detail=f"El archivo {file.filename} no contiene texto extraíble. Para informes/ensayos, sube documentos de Word o PDF con texto digital."
                    )

        # Generar nombre único
        unique_filename = f"{uuid.uuid4()}_{file.filename}"

        # Subir a GCS
        gcs_url = gcs_client.upload_blob(
            source_bytes=file_bytes,
            destination_blob_name=unique_filename,
            content_type=file.content_type or "application/octet-stream"
        )

        log.info(f"Archivo subido vía proxy: {unique_filename}")

        return {
            "gcs_filename": unique_filename,
            "gcs_url": gcs_url,
            "original_filename": file.filename
        }

    except Exception as e:
        log.error(f"Error en upload proxy: {e}")
        raise HTTPException(status_code=500, detail=str(e))
