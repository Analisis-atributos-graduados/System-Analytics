import logging
import sys
import os
import io
import uuid
import json
import re
import datetime
import traceback
import zipfile
from typing import List
import urllib.parse
import hmac
import hashlib
import base64
from datetime import timezone # Necesario para UTC

# --- ¡NUEVA IMPORTACIÓN! ---
import google.auth # Para obtener credenciales explícitamente
import google.auth.transport.requests

# Configura el logging ANTES de cualquier otra importación
try:
    from logging_config import setup_logging
    setup_logging()
except ImportError:
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

log = logging.getLogger(__name__)

log.info("--- INICIO DE ARRANQUE DEL WORKER (MODO LAZY LOADING + FIRMA MANUAL + FORZAR CREDS) ---")

# ==============================================================================
# --- 1. IMPORTACIONES RÁPIDAS
# ==============================================================================
log.info("Importando: Librerías estándar y de terceros...")
import requests
from PyPDF2 import PdfReader, PdfWriter
from thefuzz import process as fuzzy_process
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph
from reportlab.lib.units import inch
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
import sqlalchemy.exc
from google.cloud import storage, tasks_v2
from google.cloud import iam_credentials_v1

log.info("Importando: Módulos locales...")
# Asegúrate que database.py tenga pool_pre_ping=True
from database import get_db, engine, Base
from models import Evaluacion, ArchivoProcesado, CriterioConfig, ResultadoAnalisis
from schemas import (
    CriterioConfigUpdate, ExamBatchRequest, GenerateUploadURLRequest,
    FileTaskPayload, EvaluationTaskPayload, EvaluacionDetailSchema, EvaluacionSchema,
)

log.info("--- ¡IMPORTACIONES RÁPIDAS COMPLETADAS! ---")

# ==============================================================================
# --- 2. INICIALIZACIÓN DE LA BASE DE DATOS
# ==============================================================================
try:
    log.info("Intentando conexión a Base de Datos (create_all)...")
    Base.metadata.create_all(bind=engine)
    log.info("¡Conexión a BD y creación de tablas exitosa!")
except Exception as e:
    log.exception("ERROR CRÍTICO: Falló la conexión a la base de datos en create_all.")
    sys.exit(1)

# ==============================================================================
# --- 3. CONFIGURACIÓN DE CARGA PEREZOSA (LAZY LOADING) DEL MODELO DE IA
# ==============================================================================
classifier = None
log.info("Variable 'classifier' inicializada en None.")

def get_classifier():
    global classifier
    if classifier is None:
        log.info("INICIALIZANDO MODELO DE ML (esto solo ocurrirá una vez)...")
        try:
            from transformers import pipeline
            log.info("Importación de 'transformers' exitosa.")
            # Cargamos desde la carpeta horneada
            classifier = pipeline("zero-shot-classification", model="/app/model")
            log.info("Modelo de ML cargado y listo desde /app/model.")
        except Exception as e:
            log.exception("ERROR CRÍTICO: Falló la carga del modelo de ML.")
            classifier = None
    return classifier

# ==============================================================================
# --- 4. CONFIGURACIÓN GLOBAL DE LA APLICACIÓN
# ==============================================================================
log.info("Configurando FastAPI...")
app = FastAPI(
    title="EvalIA API",
    description="API para la evaluación automatizada de trabajos y exámenes.",
    version="3.0.0", # Podrías incrementar la versión si quieres
)

# Middleware para logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    log.info(f"Request: {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        log.info(f"Response: {response.status_code}")
        return response
    except Exception as e:
        log.exception(f"Unhandled exception during request to {request.url.path}")
        raise

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Considera restringir esto en producción real
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
log.info("FastAPI y CORS configurados.")

# --- Lectura de Variables de Entorno ---
log.info("Leyendo variables de entorno...")
BUCKET_NAME = os.environ.get("GCS_BUCKET_NAME")
GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
GCP_LOCATION = os.environ.get("GCP_LOCATION")
QUEUE_NAME = os.environ.get("GCS_QUEUE_NAME")
RAPIDAPI_KEY = os.environ.get("RAPIDAPI_KEY")
SERVICE_URL = os.environ.get("SERVICE_URL")
log.info("Variables de entorno leídas.")


# Configuración de la API externa de OCR
OCR_URL = "https://pen-to-print-handwriting-ocr.p.rapidapi.com/recognize/"
OCR_HEADERS = {
    "x-rapidapi-key": RAPIDAPI_KEY,
    "x-rapidapi-host": "pen-to-print-handwriting-ocr.p.rapidapi.com",
}

# --- Inicialización de Clientes de Google ---
log.info("Inicializando clientes de Google...")
try:
    # --- ¡CAMBIO AQUÍ! ---
    # Obtenemos las credenciales explícitamente del entorno
    credentials, project_id = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    log.info(f"Credenciales obtenidas: Tipo={type(credentials)}")

    storage_client = storage.Client(credentials=credentials)
    log.info("Cliente de Storage inicializado con credenciales explícitas.")

    tasks_client = tasks_v2.CloudTasksClient(credentials=credentials)
    log.info("Cliente de Cloud Tasks inicializado con credenciales explícitas.")

    iam_client = iam_credentials_v1.IAMCredentialsClient(credentials=credentials)
    log.info("Cliente de IAM Credentials inicializado con credenciales explícitas.")

except Exception as e:
    log.exception("ERROR CRÍTICO: Falló la inicialización de clientes de Google.")
    sys.exit(1)

log.info("--- ¡¡¡ARRANQUE DEL WORKER COMPLETADO!!! ---")

# ==============================================================================
# --- 5. FUNCIONES AUXILIARES (Sin cambios significativos)
# ==============================================================================
# ... (call_ocr_api, find_student_name_in_text, etc. permanecen igual) ...
def call_ocr_api(file_content: bytes, content_type: str) -> str:
    """Función centralizada para llamar a la API de OCR externa."""
    if not RAPIDAPI_KEY:
        log.error("ERROR DE CONFIGURACIÓN: La RAPIDAPI_KEY no está configurada.")
        return ""
    files = {"srcImg": ("file_to_process", file_content, content_type)}
    try:
        response = requests.post(OCR_URL, headers=OCR_HEADERS, files=files, timeout=120) # Aumentar timeout si es necesario
        response.raise_for_status() # Lanza excepción si el status es 4xx o 5xx
        result = response.json()
        ocr_text = result.get("value", "")
        log.info(f"Llamada a OCR exitosa, longitud de texto: {len(ocr_text)}")
        return ocr_text
    except requests.exceptions.Timeout:
        log.error("Error en OCR: Timeout esperando respuesta de la API.")
        return ""
    except requests.exceptions.RequestException as e:
        log.exception(f"Error crítico en la llamada a la API de OCR: {e}")
        if hasattr(e, 'response') and e.response is not None:
             log.error(f"OCR Response Status: {e.response.status_code}")
             log.error(f"OCR Response Body: {e.response.text}")
        return ""

def find_student_name_in_text(ocr_text: str, student_list: list[str]) -> str | None:
    """Busca el nombre de un alumno en el texto del OCR de forma inteligente."""
    # ... (mismo código que antes) ...
    if not ocr_text or not student_list:
        return None
    patterns = [
        r"(?:nombres? y apellidos|apellidos y nombres?|alumno|estudiante)\s*[:\-\s]\s*([a-zA-Z\sÁÉÍÓÚáéíóúñÑ,'\. ]+)",
        r"^(?:nombre|alumno|estudiante)[:\s]+([a-zA-Z\sÁÉÍÓÚáéíóúñÑ,'\. ]+)"
    ]
    text_lines = ocr_text.strip().split("\n")
    potential_names = []
    for line in text_lines:
        line_stripped = line.strip()
        if not line_stripped: continue
        for pattern in patterns:
            match = re.search(pattern, line_stripped, re.IGNORECASE)
            if match:
                name_found = match.group(1).strip()
                name_found = re.sub(r'[^\w\sÁÉÍÓÚáéíóúñÑ]+$', '', name_found).strip()
                if name_found:
                    log.info(f"Nombre potencial encontrado por patrón: '{name_found}'")
                    potential_names.append(name_found)
    for i, line in enumerate(text_lines):
        line_lower = line.strip().lower()
        if any(line_lower.startswith(keyword) or keyword + ":" in line_lower for keyword in ["alumno", "nombre", "estudiante"]):
            parts = line.split(":", 1)
            if len(parts) > 1 and parts[1].strip():
                 name_found = parts[1].strip()
                 log.info(f"Nombre potencial encontrado en línea de keyword: '{name_found}'")
                 potential_names.append(name_found)
            elif i + 1 < len(text_lines):
                next_line = text_lines[i + 1].strip()
                if next_line and len(next_line) > 3 and not any(kw in next_line.lower() for kw in ["curso:", "código:", "tema:"]):
                    log.info(f"Nombre potencial encontrado en línea siguiente: '{next_line}'")
                    potential_names.append(next_line)
    if not potential_names:
        log.info("No se encontraron nombres por patrones, buscando coincidencias directas...")
        found_direct = []
        ocr_text_lower_normalized = ' '.join(ocr_text.lower().split())
        for student in student_list:
             student_lower = student.lower()
             # Usar word boundaries para evitar coincidencias parciales (ej. "Ana" dentro de "Diana")
             if re.search(r'\b' + re.escape(student_lower) + r'\b', ocr_text_lower_normalized):
                 log.info(f"Coincidencia directa encontrada: '{student}'")
                 found_direct.append(student)
        if found_direct:
            best_direct_match = max(found_direct, key=len) # El nombre más largo suele ser más específico
            log.info(f"Mejor coincidencia directa seleccionada: '{best_direct_match}'")
            return best_direct_match
        else:
            log.warning("No se encontró ningún nombre potencial en el texto OCR.")
            return None
    log.info(f"Nombres potenciales para fuzzy matching: {potential_names}")
    # Limpiar mejor los nombres antes del fuzzy matching
    cleaned_potentials = set(re.sub(r'[^\w\sÁÉÍÓÚáéíóúñÑ]', '', name).strip() for name in potential_names if len(name.strip()) > 2)
    if not cleaned_potentials:
         log.warning("No quedaron nombres potenciales válidos después de limpiar.")
         return None
    # Usar el nombre más largo como query principal puede ser más robusto
    best_potential_query = max(cleaned_potentials, key=len)
    log.info(f"Query para fuzzy matching: '{best_potential_query}'")
    best_match = fuzzy_process.extractOne(best_potential_query, student_list)
    if best_match and best_match[1] > 75: # Umbral puede necesitar ajuste
        log.info(f"Mejor coincidencia (fuzzy > 75) encontrada: '{best_match[0]}' con score {best_match[1]}")
        return best_match[0]
    else:
        log.warning(f"No se encontró una coincidencia suficientemente buena con fuzzy matching (mejor fue {best_match}).")
        # Como fallback, intentar coincidencia directa de nuevo si el fuzzy falla
        if found_direct:
            best_direct_match = max(found_direct, key=len)
            log.info(f"Fuzzy falló, usando mejor coincidencia directa: '{best_direct_match}'")
            return best_direct_match
        return None

def formatear_texto_ocr(texto_crudo: str) -> str:
    """Toma el texto crudo del OCR y lo formatea para una mejor lectura humana."""
    # ... (mismo código que antes) ...
    if not texto_crudo: return ""
    texto = texto_crudo.replace("\\n", "\n")
    lineas = texto.split('\n')
    lineas_limpias = [re.sub(r'\s+', ' ', linea).strip() for linea in lineas]
    texto_formateado = "\n".join(lineas_limpias)
    texto_final = re.sub(r"\.(?=[a-zA-Z])", ". ", texto_formateado)
    # Eliminar líneas completamente vacías
    texto_final = "\n".join(line for line in texto_final.split('\n') if line.strip())
    return texto_final

def generar_pdf_transcripciones(archivos_procesados: list[ArchivoProcesado], evaluacion: Evaluacion) -> io.BytesIO:
    """Genera un único PDF en memoria con las transcripciones de una evaluación."""
    # ... (mismo código que antes, pero usando 'log') ...
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    styles = getSampleStyleSheet()
    style_normal = styles["Normal"]
    style_normal.fontSize = 10 # Un poco más pequeño para que quepa más
    style_normal.leading = 12
    margin = inch

    def draw_page_header(canvas_obj, title, alumno, curso_info, tema):
        try:
            canvas_obj.setFont("Helvetica-Bold", 16)
            canvas_obj.drawString(margin, height - margin, title)
            canvas_obj.setFont("Helvetica", 12)
            canvas_obj.drawString(margin, height - margin - 0.5 * inch, f"Alumno: {alumno}")
            canvas_obj.drawString(margin, height - margin - 0.75 * inch, f"Curso: {curso_info}")
            canvas_obj.drawString(margin, height - margin - 1.0 * inch, f"Tema: {tema}")
            canvas_obj.line(margin, height - margin - 1.2 * inch, width - margin, height - margin - 1.2 * inch)
        except Exception as e:
            log.error(f"Error dibujando cabecera de página: {e}")

    draw_page_header(p, "Transcripción de Examen", evaluacion.nombre_alumno, f"{evaluacion.nombre_curso} ({evaluacion.codigo_curso})", evaluacion.tema)

    # Añadir nota final si existe
    if hasattr(evaluacion, 'resultado_analisis') and evaluacion.resultado_analisis and hasattr(evaluacion.resultado_analisis, 'nota_final'):
        try:
            p.setFont("Helvetica-Bold", 12)
            p.drawString(margin, height - margin - 1.5 * inch, f"Nota Final: {evaluacion.resultado_analisis.nota_final:.2f} / 20.00")
        except Exception as e:
            log.error(f"Error añadiendo nota final al PDF: {e}")

    p.showPage() # Página de título

    page_number = 1 # Contador global de páginas

    for i, archivo in enumerate(archivos_procesados):
        page_number += 1 # Incrementar para la nueva página de contenido
        p.setFont("Helvetica", 9)
        p.drawCentredString(width/2, margin/2, f"- {page_number} -")
        p.setFont("Helvetica-Bold", 14)
        p.drawString(margin, height - margin, f"Página {i+1}: {archivo.nombre_archivo_original}")
        y_position = height - margin - 0.3*inch # Espacio después del título de página

        texto_formateado = formatear_texto_ocr(archivo.texto_extraido or "[Texto no extraído o vacío]")
        texto_html = texto_formateado.replace("\n", "<br/>")
        p_text = Paragraph(texto_html, style_normal)

        text_width = width - 2 * margin
        text_height_available = y_position - margin # Espacio disponible hasta el margen inferior

        frame_height = text_height_available
        w_actual, h_actual = p_text.wrapOn(p, text_width, frame_height)

        if h_actual <= frame_height:
            # Cabe en la página actual
            p_text.drawOn(p, margin, y_position - h_actual)
        else:
            # Necesita múltiples páginas
            lines_html = texto_html.split('<br/>')
            current_line_index = 0
            while current_line_index < len(lines_html):
                # Calcular cuántas líneas caben aproximadamente
                lines_that_fit = int(frame_height / style_normal.leading)
                if lines_that_fit <= 0: lines_that_fit = 1 # Al menos una línea

                end_index = min(current_line_index + lines_that_fit, len(lines_html))

                # Intentar ajustar el chunk actual
                text_chunk = "<br/>".join(lines_html[current_line_index:end_index])
                p_chunk = Paragraph(text_chunk, style_normal)
                w_chunk, h_chunk = p_chunk.wrapOn(p, text_width, frame_height)

                # Si el chunk calculado no cabe, reducir el número de líneas
                while h_chunk > frame_height and end_index > current_line_index + 1:
                    end_index -= 1
                    text_chunk = "<br/>".join(lines_html[current_line_index:end_index])
                    p_chunk = Paragraph(text_chunk, style_normal)
                    w_chunk, h_chunk = p_chunk.wrapOn(p, text_width, frame_height)

                # Si incluso una línea no cabe, forzar salto de página (caso raro)
                if h_chunk > frame_height and end_index == current_line_index + 1:
                     if current_line_index != 0: # Evitar página vacía si es la primera línea
                        p.showPage()
                        page_number += 1
                        p.setFont("Helvetica", 9)
                        p.drawCentredString(width/2, margin/2, f"- {page_number} -")
                        p.setFont("Helvetica-Bold", 14)
                        p.drawString(margin, height - margin, f"Página {i+1}: {archivo.nombre_archivo_original} (cont.)")
                        y_position = height - margin - 0.3*inch
                        frame_height = y_position - margin
                     # Reintentar dibujar la línea en la nueva página
                     p_chunk = Paragraph(lines_html[current_line_index], style_normal)
                     w_chunk, h_chunk = p_chunk.wrapOn(p, text_width, frame_height)
                     if h_chunk <= frame_height:
                          p_chunk.drawOn(p, margin, y_position - h_chunk)
                          current_line_index += 1
                     else: # Si una sola línea sigue sin caber... algo va muy mal
                          log.error(f"Una sola línea de texto es demasiado alta para la página: {lines_html[current_line_index]}")
                          p.drawString(margin, y_position - style_normal.leading, "[Error: Línea demasiado larga para mostrar]")
                          current_line_index += 1

                else:
                    # Dibujar el chunk que sí cabe
                    p_chunk.drawOn(p, margin, y_position - h_chunk)
                    current_line_index = end_index

                # Si quedan líneas, crear nueva página
                if current_line_index < len(lines_html):
                    p.showPage()
                    page_number += 1
                    p.setFont("Helvetica", 9)
                    p.drawCentredString(width/2, margin/2, f"- {page_number} -")
                    p.setFont("Helvetica-Bold", 14)
                    p.drawString(margin, height - margin, f"Página {i+1}: {archivo.nombre_archivo_original} (cont.)")
                    y_position = height - margin - 0.3*inch
                    frame_height = y_position - margin

        # Añadir número de página al final de cada página de contenido
        # p.setFont("Helvetica", 9)
        # p.drawCentredString(width/2, margin/2, f"- {page_number} -")

        # Si no es el último archivo, empezar una nueva página física
        if i < len(archivos_procesados) - 1:
            p.showPage()
            # page_number += 1 # Ya se incrementa al inicio del bucle
            y_position = height - margin - 0.5*inch # Reset y_position

    try:
        p.save()
        buffer.seek(0)
        log.info(f"PDF generado exitosamente para evaluación {evaluacion.id}, {page_number} páginas.")
        return buffer
    except Exception as e:
        log.exception(f"Error al guardar el PDF generado para evaluación {evaluacion.id}.")
        raise

# ==============================================================================
# --- 6. LÓGICA DE NEGOCIO PRINCIPAL (Sin cambios)
# ==============================================================================
# ... (analizar_texto_con_modelo permanece igual, usando get_classifier()) ...
def analizar_texto_con_modelo(texto: str) -> dict:
    """Toma el texto y devuelve las puntuaciones del modelo zero-shot."""
    puntajes_base = {"aplicacion_conceptos": 0.0, "relacion_contextual": 0.0, "coherencia_logica": 0.0}
    if not texto or not texto.strip():
        log.warning("analizar_texto_con_modelo llamado con texto vacío.")
        return puntajes_base
    etiquetas_candidatas = ["aplicación de conceptos", "relación contextual", "coherencia lógica"]
    try:
        modelo_ml = get_classifier() # Usa la carga perezosa
        if modelo_ml is None:
            log.error("El clasificador de ML no está disponible. No se puede analizar el texto.")
            return puntajes_base
        log.info(f"Analizando texto de longitud {len(texto)} con el modelo...")
        # Truncar si es demasiado largo para evitar errores/lentitud extrema
        max_chunk_len = 1024 * 3 # Ajusta según sea necesario (aprox 3k caracteres)
        if len(texto) > max_chunk_len:
             log.warning(f"Texto muy largo ({len(texto)} caracteres), truncando a {max_chunk_len} para análisis.")
             texto = texto[:max_chunk_len]

        resultado_modelo = modelo_ml(texto, candidate_labels=etiquetas_candidatas, multi_label=True)
        log.info("Análisis de ML completado.")
    except Exception as e:
        log.exception(f"Error durante el análisis del modelo de ML: {e}")
        return puntajes_base

    mapping = {"aplicación de conceptos": "aplicacion_conceptos", "relación contextual": "relacion_contextual", "coherencia lógica": "coherencia_logica"}

    # Validación robusta de la salida del modelo
    if isinstance(resultado_modelo, dict) and 'labels' in resultado_modelo and 'scores' in resultado_modelo:
        if isinstance(resultado_modelo['labels'], list) and isinstance(resultado_modelo['scores'], list) and \
           len(resultado_modelo['labels']) == len(resultado_modelo['scores']):
            for i in range(len(resultado_modelo["labels"])):
                label = resultado_modelo["labels"][i]
                score = resultado_modelo["scores"][i]
                # Asegurarse que score sea numérico
                if isinstance(score, (float, int)):
                     db_key = mapping.get(label)
                     if db_key:
                         # Asegurar que el puntaje esté entre 0 y 1
                         puntajes_base[db_key] = round(max(0.0, min(1.0, float(score))), 4)
                else:
                    log.warning(f"Tipo de score inesperado '{type(score)}' para label '{label}'. Score: {score}")
        else:
            log.error(f"Discrepancia en longitud o tipo de labels/scores: labels({type(resultado_modelo['labels'])}) len={len(resultado_modelo['labels'])}, scores({type(resultado_modelo['scores'])}) len={len(resultado_modelo['scores'])}")
    else:
        log.error(f"Formato inesperado del resultado del modelo de ML: {type(resultado_modelo)}")
        log.debug(f"Contenido del resultado: {resultado_modelo}")

    log.info(f"Puntajes calculados: {puntajes_base}")
    return puntajes_base


# ==============================================================================
# --- 7. ENDPOINTS DE LA API
# ==============================================================================
@app.get("/")
def read_root():
    return {"status": "ok", "message": "Bienvenido a la API de EvalIA"}

# --- ¡FUNCIÓN COMPLETAMENTE REESCRITA PARA FIRMA MANUAL! ---
@app.post("/generate-upload-url")
async def generate_upload_url(payload: GenerateUploadURLRequest):
    """Genera una URL firmada v4 para subir un archivo directamente a GCS, usando firma manual."""
    log.info("--- INICIANDO /generate-upload-url (FIRMA MANUAL) ---")
    if not payload or not payload.filename or not payload.content_type:
        log.error(f"Payload inválido recibido: {payload}")
        raise HTTPException(status_code=400, detail="Payload inválido: filename y content_type son requeridos.")

    try:
        # 1. Leer variables de entorno necesarias
        sa_email = os.environ.get("SERVICE_ACCOUNT_EMAIL")
        if not BUCKET_NAME or not sa_email:
            missing = []
            if not BUCKET_NAME: missing.append("GCS_BUCKET_NAME")
            if not sa_email: missing.append("SERVICE_ACCOUNT_EMAIL")
            log.error(f"ERROR CRÍTICO: Faltan variables de entorno: {missing}")
            raise HTTPException(status_code=500, detail=f"Configuración incompleta: Faltan variables: {', '.join(missing)}")

        log.info(f"Paso 1: Bucket: '{BUCKET_NAME}', SA Email: '{sa_email}'")

        # 2. Preparar detalles del blob
        safe_filename = re.sub(r'[^\w\-_\.]', '_', payload.filename)
        unique_filename = f"{uuid.uuid4()}-{safe_filename}"
        blob_path = unique_filename # Nombre del objeto en el bucket
        log.info(f"Paso 2: Nombre del blob en GCS: '{blob_path}'")

        # 3. Configuración para la URL firmada V4
        method = "PUT"
        expiration_seconds = 15 * 60 # 15 minutos
        current_time_utc = datetime.datetime.now(timezone.utc)
        request_timestamp = current_time_utc.strftime('%Y%m%dT%H%M%SZ')
        datestamp = current_time_utc.strftime('%Y%m%d')
        host = "storage.googleapis.com"
        # Necesitamos el ID de la cuenta de servicio para las credenciales
        credential_scope = f"{datestamp}/auto/storage/goog4_request"

        # 4. Construir los Headers Canónicos
        canonical_headers = f"content-type:{payload.content_type}\nhost:{host}\nx-goog-date:{request_timestamp}\n"
        signed_headers = "content-type;host;x-goog-date"

        # 5. Construir la Petición Canónica (para PUT, el payload es UNSIGNED-PAYLOAD)
        canonical_request = (
            f"{method}\n"
            f"/{BUCKET_NAME}/{urllib.parse.quote(blob_path, safe='')}\n" # Path con URL encoding
            f"\n" # Query string vacío para PUT
            f"{canonical_headers}\n"
            f"{signed_headers}\n"
            f"UNSIGNED-PAYLOAD"
        )
        log.debug(f"Petición Canónica:\n{canonical_request}")
        canonical_request_hash = hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()
        log.debug(f"Hash Petición Canónica: {canonical_request_hash}")

        # 6. Construir la Cadena para Firmar
        string_to_sign = (
            f"GOOG4-RSA-SHA256\n"
            f"{request_timestamp}\n"
            f"{credential_scope}\n"
            f"{canonical_request_hash}"
        )
        log.debug(f"Cadena para Firmar:\n{string_to_sign}")

        # 7. Firmar la Cadena usando IAM Credentials API
        log.info(f"Paso 3: Llamando a IAM Credentials API para firmar...")
        # El nombre del recurso de la cuenta de servicio
        resource_name = f"projects/-/serviceAccounts/{sa_email}"
        try:
            # --- ¡CAMBIO IMPORTANTE AQUÍ! ---
            # Forzamos el uso de las credenciales explícitas que inicializamos globalmente
            response = iam_client.sign_blob(
                request={
                    "name": resource_name,
                    "payload": string_to_sign.encode('utf-8'),
                }#, credentials=credentials # Esta línea ya no es necesaria si el cliente se inicializó con ellas
            )
            signature_bytes = response.signed_blob
            signature_hex = signature_bytes.hex()
            log.info(f"Paso 3: Firma obtenida de IAM exitosamente (longitud hex: {len(signature_hex)}).")
        except Exception as iam_error:
             log.exception(f"Error al llamar a IAM Credentials API (signBlob): {iam_error}")
             # Devolver un error específico si es de permisos
             # Intentar obtener más detalles del error gRPC si es posible
             grpc_status_code = getattr(iam_error, 'code', lambda: None)() if hasattr(iam_error, 'code') else None
             if grpc_status_code == 7 or "permission" in str(iam_error).lower() or "denied" in str(iam_error).lower():
                  log.error(f"¡Error de Permiso! La cuenta {sa_email} no tiene permiso 'iam.serviceAccounts.signBlob' sobre sí misma O la API IAM Credentials no está habilitada/accesible.")
                  raise HTTPException(status_code=403, detail=f"Permiso denegado al intentar firmar con {sa_email}. Verifica roles ('Creador de tokens de cuenta de servicio' sobre sí misma) y que la API IAM Credentials esté habilitada.")
             else:
                 log.error(f"Error inesperado al contactar IAM: Código={grpc_status_code}, Msg={iam_error}")
                 raise HTTPException(status_code=500, detail=f"Error al contactar el servicio de firma de IAM: {iam_error}")


        # 8. Construir la URL Firmada Final
        # Parámetros de Query requeridos para V4
        query_params = {
            "X-Goog-Algorithm": "GOOG4-RSA-SHA256",
            "X-Goog-Credential": f"{sa_email}/{credential_scope}",
            "X-Goog-Date": request_timestamp,
            "X-Goog-Expires": str(expiration_seconds),
            "X-Goog-SignedHeaders": signed_headers,
            "X-Goog-Signature": signature_hex,
        }
        encoded_query_params = urllib.parse.urlencode(query_params)

        # Usar quote_plus para espacios y otros caracteres especiales en el nombre del blob si fuera necesario
        # Aunque nuestro unique_filename debería ser seguro, es buena práctica
        safe_blob_path = urllib.parse.quote(blob_path, safe='/')
        signed_url = f"https://{host}/{BUCKET_NAME}/{safe_blob_path}?{encoded_query_params}"

        log.info("Paso 4: ¡URL firmada V4 (manual) generada exitosamente!")
        log.info("--- FIN /generate-upload-url (FIRMA MANUAL - ÉXITO) ---")
        return {"signed_url": signed_url, "gcs_filename": unique_filename, "request_timestamp": request_timestamp}

    except HTTPException as http_exc:
        # Ya logueado donde se originó, simplemente relanzar
        raise http_exc
    except Exception as e:
        log.exception(f"Error catastrófico inesperado en /generate-upload-url (firma manual): {e}")
        raise HTTPException(status_code=500, detail=f"Error interno del servidor al generar URL firmada manualmente.")


# --- ENDPOINT ORQUESTADOR PRINCIPAL (Sin cambios significativos) ---
# ... (enqueue_exam_batch permanece igual) ...
@app.post("/enqueue-exam-batch")
async def enqueue_exam_batch(payload: ExamBatchRequest, db: Session = Depends(get_db)):
    """Orquesta el procesamiento de un lote de exámenes escaneados subidos como PDFs."""
    try:
        log.info("LOG: Endpoint /enqueue-exam-batch iniciado.")
        # Validación robusta de variables de entorno
        required_vars = ["SERVICE_URL", "BUCKET_NAME", "GCP_PROJECT_ID", "GCP_LOCATION", "QUEUE_NAME"]
        missing_vars = [var for var in required_vars if not os.environ.get(var)]
        if missing_vars:
             log.error(f"ERROR CRÍTICO: Faltan variables de entorno necesarias: {missing_vars}")
             raise HTTPException(status_code=500, detail=f"Configuración del servidor incompleta. Faltan variables: {', '.join(missing_vars)}")
        # Validación de clientes Google
        if storage_client is None or tasks_client is None:
             log.error("ERROR CRÍTICO: Clientes de Google no inicializados.")
             raise HTTPException(status_code=500, detail="Error interno del servidor: Clientes Google no disponibles.")
        # Validación de la lista de alumnos
        student_list = [name.strip() for name in payload.student_list.split("\n") if name.strip()]
        if not student_list:
             log.error("Lista de alumnos vacía o mal formateada.")
             raise HTTPException(status_code=400, detail="La lista de alumnos está vacía o mal formateada.")
        bucket = storage_client.bucket(BUCKET_NAME)
        # Validación de archivos PDF
        sorted_pdfs = {}
        if not payload.pdf_files:
             log.error("No se proporcionaron archivos PDF en el payload.")
             raise HTTPException(status_code=400, detail="No se proporcionaron archivos PDF.")
        log.info(f"Recibidos {len(payload.pdf_files)} archivos PDF para procesar.")
        for pdf_info in payload.pdf_files:
             if not hasattr(pdf_info, 'original_filename') or not hasattr(pdf_info, 'gcs_filename'):
                  log.error(f"Entrada inválida en pdf_files: {pdf_info}")
                  raise HTTPException(status_code=400, detail="Formato inválido en la lista de archivos PDF.")
             # Regex más robusto para extraer el número al final, antes de .pdf
             match = re.search(r"_(\d+)\.pdf$", pdf_info.original_filename, re.IGNORECASE)
             if not match: # Intentar si solo hay un número en todo el nombre
                  numbers = re.findall(r"\d+", pdf_info.original_filename)
                  if len(numbers) == 1:
                      match = re.search(r"(\d+)", pdf_info.original_filename)
             if match:
                 page_num = int(match.group(1))
                 if page_num > 0:
                    log.debug(f"Número de página {page_num} extraído de '{pdf_info.original_filename}'")
                    sorted_pdfs[page_num] = pdf_info
                 else:
                     log.warning(f"Número de página inválido (cero o negativo) extraído de '{pdf_info.original_filename}'. Se omitirá.")
             else:
                 log.warning(f"No se pudo extraer el número de página de '{pdf_info.original_filename}'. Se omitirá.")
        if not sorted_pdfs:
            log.error("No se pudo identificar el número de cara válido en ninguno de los nombres de PDF.")
            raise HTTPException(status_code=400, detail="No se pudo identificar el número de cara en ninguno de los nombres de los PDFs proporcionados.")
        log.info(f"PDFs ordenados por número de página: {list(sorted(sorted_pdfs.keys()))}")
        # Procesamiento de PDFs
        all_pages = {}
        blobs_to_delete = []
        try:
            for page_num, pdf_info in sorted(sorted_pdfs.items()):
                log.info(f"Descargando y leyendo PDF cara {page_num}: {pdf_info.gcs_filename}")
                blob = bucket.blob(pdf_info.gcs_filename)
                if not blob.exists():
                     log.error(f"El blob {pdf_info.gcs_filename} no existe en el bucket {BUCKET_NAME}. Abortando.")
                     # Intentar borrar los blobs descargados hasta ahora
                     for b_name in blobs_to_delete:
                          try: bucket.blob(b_name).delete()
                          except: log.warning(f"Fallo al borrar {b_name} en rollback.")
                     raise HTTPException(status_code=404, detail=f"Archivo no encontrado en GCS: {pdf_info.gcs_filename}")
                pdf_bytes = blob.download_as_bytes(timeout=60) # Añadir timeout
                blobs_to_delete.append(pdf_info.gcs_filename) # Añadir a la lista SÓLO si se descargó
                reader = PdfReader(io.BytesIO(pdf_bytes))
                if not reader.pages:
                     log.warning(f"El PDF {pdf_info.original_filename} (cara {page_num}) no contiene páginas. Se omitirá esta cara.")
                     # No necesitamos borrarlo de sorted_pdfs aquí, simplemente no se añadirá a all_pages
                     continue
                all_pages[page_num] = reader.pages
                log.info(f"Cara {page_num} leída, {len(reader.pages)} páginas encontradas.")
        except Exception as e:
            log.exception(f"Error al procesar el PDF {pdf_info.gcs_filename}: {e}")
            # Intentar borrar todos los blobs descargados hasta ahora
            for blob_name in blobs_to_delete:
                try: bucket.blob(blob_name).delete()
                except: log.warning(f"No se pudo borrar blob {blob_name} durante el rollback.")
            raise HTTPException(status_code=500, detail=f"Error al leer archivo PDF desde GCS: {pdf_info.original_filename}")
        # Borrado de blobs originales después de leerlos todos
        log.info(f"Borrando {len(blobs_to_delete)} blobs originales del bucket...")
        deleted_count = 0
        failed_deletes = []
        for blob_name in blobs_to_delete:
            try:
                # Verificar de nuevo si existe antes de borrar
                blob_to_del = bucket.blob(blob_name)
                if blob_to_del.exists():
                     blob_to_del.delete(timeout=30) # Añadir timeout
                     deleted_count += 1
                else:
                    log.info(f"Blob {blob_name} ya no existía al intentar borrar.")
            except Exception as e:
                log.warning(f"No se pudo borrar el blob {blob_name}: {e}")
                failed_deletes.append(blob_name)
        log.info(f"Se borraron {deleted_count} blobs.")
        if failed_deletes: log.error(f"Falló el borrado de los siguientes blobs: {failed_deletes}")
        # Verificar si tenemos la cara 1
        if 1 not in all_pages or not all_pages[1]:
            log.error("Procesamiento abortado: La cara 1 no se encontró o no contiene páginas después de la lectura.")
            return {"message": "Procesamiento abortado: No se encontraron páginas válidas en el PDF de la cara 1."}
        num_students = len(all_pages[1])
        log.info(f"Detectados {num_students} alumnos basado en la cara 1.")
        # Procesamiento por alumno
        processed_count = 0
        evaluacion_ids = []
        parent_queue = tasks_client.queue_path(GCP_PROJECT_ID, GCP_LOCATION, QUEUE_NAME)
        for i in range(num_students):
            log.info(f"Procesando examen para el alumno índice {i}...")
            student_exam_pages = []
            page_original_names = []
            # Construir el examen del alumno página por página
            for page_num, pages in sorted(all_pages.items()):
                # Determinar índice correcto (pares invertido, impares normal)
                is_even_page = (page_num % 2 == 0)
                page_index = (len(pages) - 1 - i) if is_even_page else i
                if 0 <= page_index < len(pages):
                    student_exam_pages.append(pages[page_index])
                    original_pdf_info = sorted_pdfs.get(page_num)
                    page_original_names.append(original_pdf_info.original_filename if original_pdf_info else f"cara_{page_num}_nombre_desconocido")
                else:
                    log.warning(f"Índice {page_index} fuera de rango para cara {page_num} (total páginas: {len(pages)}). Alumno {i}. Página omitida.")
                    page_original_names.append(f"cara_{page_num}_PAGINA_FALTANTE")
            if not student_exam_pages:
                log.warning(f"No se encontraron páginas válidas para el alumno índice {i}. Omitiendo.")
                continue
            # Procesar la primera página para OCR e identificación
            try:
                writer = PdfWriter(); writer.add_page(student_exam_pages[0]); first_page_io = io.BytesIO(); writer.write(first_page_io)
                first_page_bytes = first_page_io.getvalue()
                log.info(f"Generado PDF de la primera página para alumno {i}, tamaño: {len(first_page_bytes)} bytes.")
            except Exception as e:
                 log.exception(f"Error al crear PDF de la primera página para alumno {i}: {e}")
                 continue # Saltar a siguiente alumno si la primera página falla
            ocr_text_first_page = call_ocr_api(first_page_bytes, "application/pdf")
            student_name = find_student_name_in_text(ocr_text_first_page or "", student_list)
            if not student_name:
                log.warning(f"No se pudo identificar el nombre del alumno en el índice {i} a partir de la primera página. Omitiendo este examen.")
                continue
            log.info(f"Alumno {i} identificado como: {student_name}")
            # Crear registro de Evaluación en la BD
            evaluacion_id = None # Resetear por si falla la creación
            try:
                eval_data = payload.model_dump(exclude={"pdf_files", "student_list"})
                # Validar datos antes de crear
                required_eval_fields = ["nombre_curso", "codigo_curso", "instructor", "semestre", "tema"]
                missing_eval_fields = [f for f in required_eval_fields if not eval_data.get(f)]
                if missing_eval_fields:
                    log.error(f"Faltan campos obligatorios para crear Evaluación para {student_name}: {missing_eval_fields}")
                    continue # Saltar si faltan datos
                new_evaluacion = Evaluacion(**eval_data, nombre_alumno=student_name)
                db.add(new_evaluacion); db.flush(); # Usar flush para obtener ID antes de commit
                evaluacion_id = new_evaluacion.id
                if not evaluacion_id:
                     raise ValueError("No se pudo obtener el ID de la nueva evaluación después de flush.")
                log.info(f"Creada Evaluación ID: {evaluacion_id} para {student_name}")
            except Exception as e:
                log.exception(f"Error al guardar la Evaluación para {student_name} en la BD: {e}")
                db.rollback()
                log.error(f"No se pudo guardar la evaluación para {student_name}, se omitirá este examen.")
                continue # Saltar si la evaluación no se puede guardar
            evaluacion_ids.append(evaluacion_id) # Añadir ID solo si se guardó
            # Procesar y subir cada página, creando tareas
            tasks_created_count = 0
            for page_idx, page in enumerate(student_exam_pages):
                unique_filename = None # Para asegurarnos de que se genera
                try:
                    writer = PdfWriter(); writer.add_page(page); page_io = io.BytesIO(); writer.write(page_io)
                    page_bytes = page_io.getvalue()
                    original_page_filename = page_original_names[page_idx] if page_idx < len(page_original_names) else f"pagina_{page_idx+1}"
                    # Crear un nombre de archivo más robusto y único
                    safe_student_name = re.sub(r'[^\w\-]+', '_', student_name)
                    unique_filename = f"{evaluacion_id}/{safe_student_name}_page_{page_idx+1}_{uuid.uuid4().hex[:8]}.pdf" # Más corto
                    log.info(f"Subiendo página {page_idx+1} para {student_name} a GCS como '{unique_filename}'")
                    blob_page = bucket.blob(unique_filename)
                    blob_page.upload_from_string(page_bytes, content_type="application/pdf", timeout=60) # Añadir timeout
                    log.info(f"Página {page_idx+1} subida exitosamente.")
                    # Crear tarea solo si la subida fue exitosa
                    task_payload = FileTaskPayload(gcs_filename=unique_filename, original_filename=original_page_filename, evaluacion_id=evaluacion_id)
                    # Pasar OCR precalculado solo para la primera página
                    if page_idx == 0: task_payload.precomputed_ocr_text = ocr_text_first_page
                    log.info(f"Creando tarea de archivo para página {page_idx+1}...")
                    # Construir la tarea
                    task_definition = {
                        "http_request": {
                            "url": f"{SERVICE_URL}/process-file-task",
                            "http_method": tasks_v2.HttpMethod.POST,
                            "headers": {"Content-Type": "application/json"},
                            "body": task_payload.model_dump_json().encode('utf-8'),
                            # OIDC token para autenticar la tarea en Cloud Run (si es necesario)
                            # "oidc_token": {
                            #     "service_account_email": os.environ.get("SERVICE_ACCOUNT_EMAIL") # Usar la misma SA del servicio
                            # },
                        }
                    }
                    created_task = tasks_client.create_task(parent=parent_queue, task=task_definition)
                    log.debug(f"Tarea de archivo creada: {created_task.name}")
                    tasks_created_count +=1
                except Exception as e:
                    # Si falla, intentar borrar el blob si se subió
                    if unique_filename:
                        try:
                            blob_page = bucket.blob(unique_filename)
                            if blob_page.exists(): blob_page.delete()
                        except: log.warning(f"Fallo al borrar {unique_filename} en rollback de tarea.")
                    log.exception(f"Error al procesar/subir/crear tarea para página {page_idx+1} de alumno {student_name} (ID Eval: {evaluacion_id}): {e}")
                    # Considerar si continuar con las otras páginas o abortar para este alumno
            log.info(f"Creadas {tasks_created_count} tareas de archivo para la evaluación {evaluacion_id}.")
            # Crear tarea de agregación solo si se creó al menos una tarea de archivo
            if tasks_created_count > 0:
                try:
                    agg_task_payload = EvaluationTaskPayload(evaluacion_id=evaluacion_id)
                    agg_task_def = {
                        "http_request": {
                            "url": f"{SERVICE_URL}/process-evaluation-task",
                            "http_method": tasks_v2.HttpMethod.POST,
                            "headers": {"Content-Type": "application/json"},
                            "body": agg_task_payload.model_dump_json().encode('utf-8'),
                            # "oidc_token": { # Mismo OIDC token si es necesario
                            #     "service_account_email": os.environ.get("SERVICE_ACCOUNT_EMAIL")
                            # },
                        }
                        # Añadir schedule_time si queremos retrasar la agregación
                        # "schedule_time": datetime.datetime.now(timezone.utc) + datetime.timedelta(minutes=5)
                    }
                    created_agg_task = tasks_client.create_task(parent=parent_queue, task=agg_task_def)
                    log.info(f"Creada tarea de agregación {created_agg_task.name} para la evaluación {evaluacion_id}.")
                    processed_count += 1 # Incrementar contador de exámenes orquestados
                except Exception as e:
                    log.exception(f"Error CRÍTICO al crear la tarea de agregación para la evaluación {evaluacion_id}: {e}")
                    # Decidir si se debe intentar borrar la evaluación y tareas de archivo creadas (rollback complejo)
                    # Por ahora, solo logueamos el error grave
            else:
                 log.warning(f"No se crearon tareas de archivo para {evaluacion_id}, por lo tanto no se crea tarea de agregación.")
            # Commit final por alumno, solo si todo fue bien hasta la creación de tareas
            try:
                db.commit()
            except Exception as commit_err:
                 log.exception(f"Error final al hacer commit para el alumno {student_name} (Eval ID {evaluacion_id}): {commit_err}")
                 db.rollback()
                 # Quitar el ID de la lista si el commit final falló
                 if evaluacion_id in evaluacion_ids: evaluacion_ids.remove(evaluacion_id)
                 processed_count = max(0, processed_count -1) # Decrementar si falló el commit

        final_message = f"Se ha completado la orquestación. Se iniciará el procesamiento para {processed_count} de {num_students} exámenes identificados."
        log.info(final_message)
        return {"message": final_message, "evaluacion_ids": evaluacion_ids}
    except HTTPException as http_exc:
         # Loguear antes de relanzar para asegurar que quede registrado
         log.error(f"HTTP Exception en orquestación: {http_exc.status_code} - {http_exc.detail}")
         raise http_exc
    except Exception as e:
        # Captura genérica final para errores inesperados
        log.exception(f"ERROR CRÍTICO INESPERADO en /enqueue-exam-batch: {e}")
        raise HTTPException(status_code=500, detail=f"Ocurrió un error interno inesperado durante la orquestación.")

# --- ENDPOINTS WORKER (PROCESAMIENTO ASÍNCRONO) ---
# ... (process_file_task y process_evaluation_task permanecen igual) ...
@app.post("/process-file-task")
async def process_file_task(payload: FileTaskPayload, db: Session = Depends(get_db)):
    """WORKER: Procesa UN solo archivo (página de examen)."""
    log.info(f"[TASK-FILE] Recibido payload: {payload.original_filename} para evaluacion_id {payload.evaluacion_id}")
    texto_extraido = payload.precomputed_ocr_text
    blob = storage_client.bucket(BUCKET_NAME).blob(payload.gcs_filename)
    archivo_id = None
    try:
        if not blob.exists():
            log.error(f"[TASK-FILE] El blob {payload.gcs_filename} NO EXISTE en el bucket {BUCKET_NAME}. Tarea fallida.")
            # Devolver 404 para que Cloud Tasks no reintente indefinidamente
            raise HTTPException(status_code=404, detail=f"Archivo GCS no encontrado: {payload.gcs_filename}")
        if not texto_extraido:
            log.info(f"[TASK-FILE] Extrayendo texto para {payload.gcs_filename} usando OCR...")
            # Descargar con timeout
            try:
                file_bytes = blob.download_as_bytes(timeout=60)
            except Exception as download_err:
                 log.exception(f"[TASK-FILE] Error descargando blob {payload.gcs_filename}: {download_err}")
                 raise HTTPException(status_code=500, detail="Error descargando archivo de GCS")
            log.info(f"[TASK-FILE] Blob descargado, tamaño: {len(file_bytes)} bytes.")
            texto_extraido = call_ocr_api(file_bytes, "application/pdf")
            log.info(f"[TASK-FILE] Texto extraído, longitud: {len(texto_extraido) if texto_extraido else 0}")
        else:
            log.info(f"[TASK-FILE] Usando texto OCR precalculado.")

        # Intentar encontrar o crear el registro en BD
        try:
            # Usar SELECT FOR UPDATE para evitar race conditions si dos tareas intentan crear el mismo registro
            archivo_existente = db.query(ArchivoProcesado)\
                .filter(ArchivoProcesado.evaluacion_id == payload.evaluacion_id,
                        ArchivoProcesado.nombre_archivo_original == payload.original_filename)\
                .with_for_update().first()

            if archivo_existente:
                 log.warning(f"[TASK-FILE] Ya existe un ArchivoProcesado para {payload.original_filename} (ID: {archivo_existente.id}). Actualizando texto.")
                 archivo_existente.texto_extraido = texto_extraido or ""
                 db.commit(); db.refresh(archivo_existente)
                 archivo_id = archivo_existente.id
            else:
                archivo_procesado = ArchivoProcesado(
                    nombre_archivo_original=payload.original_filename,
                    texto_extraido=texto_extraido or "",
                    evaluacion_id=payload.evaluacion_id
                )
                log.info(f"[TASK-FILE] Guardando NUEVO ArchivoProcesado: {archivo_procesado.nombre_archivo_original}")
                db.add(archivo_procesado); db.commit(); db.refresh(archivo_procesado)
                archivo_id = archivo_procesado.id
            log.info(f"[TASK-FILE] ArchivoProcesado guardado/actualizado con ID: {archivo_id}")
        except sqlalchemy.exc.OperationalError as db_op_err:
             log.exception(f"[TASK-FILE] Error operacional de BD guardando ArchivoProcesado: {db_op_err}")
             db.rollback()
             # Reintentar podría tener sentido aquí, lanzar 503 Service Unavailable
             raise HTTPException(status_code=503, detail="Error temporal de base de datos, reintentar más tarde.")
        except Exception as db_err:
            log.exception(f"[TASK-FILE] Error guardando ArchivoProcesado en BD: {db_err}")
            db.rollback()
            # Error no recuperable probablemente, lanzar 500
            raise HTTPException(status_code=500, detail="Error guardando datos en la base de datos.")

    except HTTPException as http_exc:
         # Loguear y relanzar para que Cloud Tasks maneje el código de estado
         log.error(f"[TASK-FILE] HTTP Exception: {http_exc.status_code} - {http_exc.detail}")
         raise http_exc
    except Exception as e:
        log.exception(f"[TASK-FILE] Error INESPERADO procesando {payload.gcs_filename}: {e}")
        # Asegurar rollback si hubo error antes de commit
        db.rollback()
        # Lanzar 500 para indicar fallo no recuperable
        raise HTTPException(status_code=500, detail=f"Error inesperado en worker al procesar archivo: {e}")
    finally:
        # Borrado del blob, independientemente del éxito o fallo del procesamiento
        try:
            blob_ref_final = storage_client.bucket(BUCKET_NAME).blob(payload.gcs_filename)
            if blob_ref_final.exists():
                blob_ref_final.delete(timeout=30) # Añadir timeout
                log.info(f"[TASK-FILE] Blob {payload.gcs_filename} eliminado.")
            else:
                 log.info(f"[TASK-FILE] Blob {payload.gcs_filename} no encontrado para borrar (posiblemente ya borrado).")
        except Exception as e:
            log.warning(f"[TASK-FILE] No se pudo eliminar el blob {payload.gcs_filename}: {e}")

    # Si llegamos aquí sin errores, la tarea fue exitosa
    if archivo_id:
        return {"status": "success", "archivo_id": archivo_id}
    else:
        # Esto no debería ocurrir si no hubo excepciones
        log.error("[TASK-FILE] La tarea finalizó sin error pero no se obtuvo archivo_id.")
        raise HTTPException(status_code=500, detail="Error interno: No se pudo obtener el ID del archivo procesado.")


@app.post("/process-evaluation-task")
async def process_evaluation_task(payload: EvaluationTaskPayload, db: Session = Depends(get_db)):
    """WORKER FINAL: Agrega textos, califica y guarda el análisis final de una evaluación."""
    log.info(f"[TASK-EVAL] Recibido payload para evaluacion_id {payload.evaluacion_id}")
    resultado_id = None
    try:
        # Usar SELECT FOR UPDATE para evitar race conditions si se reintenta la tarea
        evaluacion = db.query(Evaluacion).filter(Evaluacion.id == payload.evaluacion_id).with_for_update().first()
        if not evaluacion:
            log.error(f"[TASK-EVAL] La evaluación {payload.evaluacion_id} no existe. Tarea abortada (404).")
            # Devolver 404 para que Cloud Tasks no reintente
            raise HTTPException(status_code=404, detail=f"Evaluación no encontrada: {payload.evaluacion_id}")

        # Comprobar si ya existe un resultado para esta evaluación (idempotencia)
        resultado_existente = db.query(ResultadoAnalisis).filter(ResultadoAnalisis.evaluacion_id == payload.evaluacion_id).first()
        if resultado_existente:
            log.warning(f"[TASK-EVAL] Ya existe un ResultadoAnalisis (ID: {resultado_existente.id}) para la evaluación {payload.evaluacion_id}. Tarea completada (idempotencia).")
            return {"status": "success", "resultado_id": resultado_existente.id, "message": "Resultado ya existía."}

        # Obtener archivos procesados
        archivos = db.query(ArchivoProcesado).filter(ArchivoProcesado.evaluacion_id == payload.evaluacion_id).order_by(ArchivoProcesado.nombre_archivo_original).all()
        if not archivos:
             log.warning(f"[TASK-EVAL] No se encontraron ArchivoProcesado para {payload.evaluacion_id}. ¿Tareas de archivo fallaron o aún no terminan?")
             # Devolver un error que permita reintentos (ej. 503)
             raise HTTPException(status_code=503, detail="Archivos procesados aún no disponibles, reintentar más tarde.")
        log.info(f"[TASK-EVAL] Se encontraron {len(archivos)} ArchivoProcesado para {payload.evaluacion_id}")

        # Construir texto completo y analizar
        texto_completo = "\n\n--- Nueva Página ---\n\n".join([f"Archivo: {a.nombre_archivo_original}\n\n{a.texto_extraido}" for a in archivos if a.texto_extraido])
        log.info(f"[TASK-EVAL] Texto completo para análisis, longitud: {len(texto_completo)}")

        # Obtener criterios (con fallback)
        try:
            criterios_db = db.query(CriterioConfig).all()
            pesos_criterios = {c.nombre: c.peso for c in criterios_db} if criterios_db else {"aplicacion_conceptos": 0.4, "relacion_contextual": 0.3, "coherencia_logica": 0.3}
            log.info(f"Usando pesos de criterios: {pesos_criterios}")
        except Exception as db_err:
             log.exception("Error al obtener criterios de la BD, usando pesos por defecto.")
             pesos_criterios = {"aplicacion_conceptos": 0.4, "relacion_contextual": 0.3, "coherencia_logica": 0.3}

        resultados_crudos = analizar_texto_con_modelo(texto_completo)
        log.info(f"[TASK-EVAL] Resultados crudos del ML: {resultados_crudos}")

        # Calcular nota final (con validación)
        puntaje_ponderado = 0.0
        try:
             for crit_nombre, crit_peso in pesos_criterios.items():
                  # Asegurarse de que el puntaje y peso sean floats válidos
                  puntaje_crudo_val = resultados_crudos.get(crit_nombre)
                  crit_peso_val = crit_peso
                  if isinstance(puntaje_crudo_val, (float, int)) and isinstance(crit_peso_val, (float, int)):
                       puntaje_ponderado += float(puntaje_crudo_val) * float(crit_peso_val)
                  else:
                       log.warning(f"Tipo inválido para cálculo: puntaje_crudo={puntaje_crudo_val}({type(puntaje_crudo_val)}), crit_peso={crit_peso_val}({type(crit_peso_val)}) para criterio '{crit_nombre}'")
        except Exception as calc_err:
            log.exception("Error calculando el puntaje ponderado. Se usará 0.")
            puntaje_ponderado = 0.0 # Asegurar que sea float
        # Validar y redondear nota final
        nota_final = round(puntaje_ponderado * 20, 2)
        nota_final = max(0.0, min(20.0, nota_final)) # Clamp entre 0 y 20
        log.info(f"[TASK-EVAL] Nota final calculada: {nota_final}")

        # Guardar resultado en BD
        try:
            # Crear y guardar el nuevo resultado
            resultado_analisis = ResultadoAnalisis(
                evaluacion_id=payload.evaluacion_id,
                aplicacion_conceptos=resultados_crudos.get("aplicacion_conceptos", 0.0),
                relacion_contextual=resultados_crudos.get("relacion_contextual", 0.0),
                coherencia_logica=resultados_crudos.get("coherencia_logica", 0.0),
                nota_final=nota_final
            )
            log.info(f"[TASK-EVAL] Guardando NUEVO ResultadoAnalisis, nota: {nota_final}")
            db.add(resultado_analisis); db.commit(); db.refresh(resultado_analisis)
            resultado_id = resultado_analisis.id
            log.info(f"[TASK-EVAL] ResultadoAnalisis guardado con ID: {resultado_id}")
        except sqlalchemy.exc.IntegrityError as int_err:
             log.warning(f"[TASK-EVAL] Error de integridad al guardar ResultadoAnalisis (posiblemente creado por otra tarea concurrente): {int_err}")
             db.rollback()
             # Intentar obtener el ID del resultado que ya existe
             resultado_existente_retry = db.query(ResultadoAnalisis).filter(ResultadoAnalisis.evaluacion_id == payload.evaluacion_id).first()
             if resultado_existente_retry:
                 log.info(f"[TASK-EVAL] Se encontró resultado existente (ID: {resultado_existente_retry.id}) después de error de integridad.")
                 return {"status": "success", "resultado_id": resultado_existente_retry.id, "message": "Resultado ya existía (detectado tras IntegrityError)."}
             else:
                 log.error("[TASK-EVAL] No se pudo encontrar el resultado existente después de IntegrityError.")
                 raise HTTPException(status_code=500, detail="Conflicto al guardar el resultado, reintentar.")
        except sqlalchemy.exc.OperationalError as db_op_err:
             log.exception(f"[TASK-EVAL] Error operacional de BD guardando ResultadoAnalisis: {db_op_err}")
             db.rollback()
             raise HTTPException(status_code=503, detail="Error temporal de base de datos, reintentar más tarde.")
        except Exception as db_err:
            log.exception(f"[TASK-EVAL] Error guardando ResultadoAnalisis en BD: {db_err}")
            db.rollback()
            raise HTTPException(status_code=500, detail="Error guardando resultado en la base de datos.")

    except HTTPException as http_exc:
         # Loguear y relanzar para que Cloud Tasks maneje el código de estado
         log.error(f"[TASK-EVAL] HTTP Exception: {http_exc.status_code} - {http_exc.detail}")
         raise http_exc
    except Exception as e:
        log.exception(f"[TASK-EVAL] Error INESPERADO procesando evaluación {payload.evaluacion_id}: {e}")
        # Asegurar rollback si hubo error antes de commit
        db.rollback()
        # Lanzar 500 para indicar fallo no recuperable
        raise HTTPException(status_code=500, detail=f"Error inesperado en worker al procesar evaluación: {e}")

    # Si llegamos aquí sin errores, la tarea fue exitosa
    if resultado_id:
        return {"status": "success", "resultado_id": resultado_id}
    else:
        # Esto no debería ocurrir si no hubo excepciones
        log.error("[TASK-EVAL] La tarea finalizó sin error pero no se obtuvo resultado_id.")
        raise HTTPException(status_code=500, detail="Error interno: No se pudo obtener el ID del resultado del análisis.")


# --- ENDPOINTS DE CONSULTA Y GESTIÓN (Sin cambios) ---
# ... (get_transcripcion_pdf, get_transcripciones_zip, etc. permanecen igual) ...
@app.get("/evaluaciones/{evaluacion_id}/transcripcion/pdf")
def get_transcripcion_pdf(evaluacion_id: int, db: Session = Depends(get_db)):
    """Genera y devuelve un PDF con todas las transcripciones de una evaluación."""
    try:
        log.info(f"Solicitud GET /evaluaciones/{evaluacion_id}/transcripcion/pdf")
        # Cargar también el resultado para incluir la nota
        evaluacion = db.query(Evaluacion).options(joinedload(Evaluacion.resultado_analisis)).filter(Evaluacion.id == evaluacion_id).first()
        if not evaluacion:
            log.warning(f"PDF no generado: Evaluación {evaluacion_id} no encontrada.")
            raise HTTPException(status_code=404, detail="Evaluación no encontrada.")
        # Ordenar archivos para consistencia en el PDF
        archivos = db.query(ArchivoProcesado).filter(ArchivoProcesado.evaluacion_id == evaluacion_id).order_by(ArchivoProcesado.nombre_archivo_original).all()
        if not archivos:
            log.warning(f"PDF no generado: No hay archivos transcritos para evaluación {evaluacion_id}.")
            raise HTTPException(status_code=404, detail="No hay archivos transcritos para esta evaluación.")
        # Generar el PDF
        pdf_buffer = generar_pdf_transcripciones(archivos, evaluacion)
        # Crear nombre de archivo seguro
        safe_alumno_name = re.sub(r'[^\w\-]+', '_', evaluacion.nombre_alumno)
        filename = f"transcripcion_{safe_alumno_name}_{evaluacion_id}.pdf"
        headers = {'Content-Disposition': f'attachment; filename="{filename}"'}
        log.info(f"PDF generado para {evaluacion_id}, enviando respuesta.")
        return StreamingResponse(pdf_buffer, headers=headers, media_type='application/pdf')
    except HTTPException as http_exc:
        raise http_exc # Relanzar excepciones HTTP conocidas
    except Exception as e:
        log.exception(f"Error al generar PDF para evaluación {evaluacion_id}: {e}")
        raise HTTPException(status_code=500, detail="Error interno al generar el PDF.")


@app.post("/evaluaciones/transcripciones/zip")
async def get_transcripciones_zip(evaluacion_ids: List[int], db: Session = Depends(get_db)):
    """Genera y devuelve un archivo ZIP con las transcripciones PDF de múltiples evaluaciones."""
    if not evaluacion_ids:
        raise HTTPException(status_code=400, detail="Se requiere al menos un ID de evaluación.")
    # Limitar el número de archivos para evitar abusos/errores de memoria
    MAX_FILES_IN_ZIP = 50
    if len(evaluacion_ids) > MAX_FILES_IN_ZIP:
        log.warning(f"Solicitud de ZIP para {len(evaluacion_ids)} evaluaciones excede el límite de {MAX_FILES_IN_ZIP}.")
        raise HTTPException(status_code=400, detail=f"Demasiadas evaluaciones solicitadas. Máximo permitido: {MAX_FILES_IN_ZIP}.")

    log.info(f"Solicitud POST /evaluaciones/transcripciones/zip para IDs: {evaluacion_ids}")
    zip_buffer = io.BytesIO()
    files_added = 0
    errors_generating = []

    try:
        # Usar zipfile en modo 'w' (write)
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED, False) as zipper:
            for evaluacion_id in evaluacion_ids:
                evaluacion = None # Resetear por si falla la consulta
                try:
                    # Cargar evaluación y resultado para la nota
                    evaluacion = db.query(Evaluacion).options(joinedload(Evaluacion.resultado_analisis)).filter(Evaluacion.id == evaluacion_id).first()
                    if not evaluacion:
                        log.warning(f"[ZIP] Evaluación con ID {evaluacion_id} no encontrada. Se omitirá.")
                        errors_generating.append(f"ID {evaluacion_id}: Evaluación no encontrada.")
                        continue

                    # Cargar archivos asociados
                    archivos = db.query(ArchivoProcesado).filter(ArchivoProcesado.evaluacion_id == evaluacion_id).order_by(ArchivoProcesado.nombre_archivo_original).all()
                    if not archivos:
                        log.warning(f"[ZIP] No hay archivos transcritos para la evaluación {evaluacion_id}. Se omitirá.")
                        errors_generating.append(f"ID {evaluacion_id}: Sin archivos transcritos.")
                        continue

                    # Generar PDF en memoria
                    pdf_buffer = generar_pdf_transcripciones(archivos, evaluacion)

                    # Crear nombre de archivo seguro y añadir al ZIP
                    safe_alumno_name = re.sub(r'[^\w\-]+', '_', evaluacion.nombre_alumno)
                    # Añadir ID al inicio para ordenar y evitar colisiones
                    base_filename = f"{evaluacion_id}_{safe_alumno_name}_transcripcion.pdf"
                    # Truncar si es demasiado largo para sistemas de archivos antiguos
                    max_len = 100
                    filename = (base_filename[:max_len-4] + '.pdf') if len(base_filename) > max_len else base_filename
                    zipper.writestr(filename, pdf_buffer.getvalue())
                    files_added += 1
                    log.debug(f"[ZIP] Añadido '{filename}' al archivo ZIP.")

                except Exception as pdf_err:
                     # Loguear error específico de generación de PDF
                     log.exception(f"[ZIP] Error al generar PDF para {evaluacion_id} ({evaluacion.nombre_alumno if evaluacion else 'ID desconocido'}), se omitirá del ZIP: {pdf_err}")
                     errors_generating.append(f"ID {evaluacion_id}: Error al generar PDF ({str(pdf_err)[:50]}...).") # Mensaje corto

        # Después del bucle, verificar si se añadió algún archivo
        if files_added == 0:
             log.error("[ZIP] No se pudo generar ningún PDF para los IDs solicitados.")
             error_details = "; ".join(errors_generating) if errors_generating else "Ningún archivo encontrado o generado."
             raise HTTPException(status_code=404, detail=f"No se pudieron generar PDFs. Detalles: {error_details}")

        # Preparar respuesta ZIP
        zip_buffer.seek(0)
        # Nombre de archivo ZIP con timestamp
        zip_filename = f"transcripciones_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        headers = {'Content-Disposition': f'attachment; filename="{zip_filename}"'}
        log.info(f"ZIP generado con {files_added} archivos PDF, enviando respuesta. Errores durante generación: {len(errors_generating)}")
        return StreamingResponse(zip_buffer, headers=headers, media_type='application/zip')

    except HTTPException as http_exc:
        # Relanzar excepciones HTTP conocidas
        raise http_exc
    except Exception as e:
        # Capturar errores inesperados durante la creación del ZIP
        log.exception(f"Error crítico al generar ZIP: {e}")
        raise HTTPException(status_code=500, detail="Error interno al generar el archivo ZIP.")

@app.get("/evaluaciones", response_model=List[EvaluacionSchema])
def get_all_evaluaciones(db: Session = Depends(get_db)):
    """Obtiene una lista de todas las evaluaciones (metadata)."""
    try:
        log.info("Solicitud GET /evaluaciones")
        # Considerar paginación si la lista puede ser muy grande
        evaluaciones = db.query(Evaluacion).order_by(Evaluacion.id.desc()).limit(1000).all() # Limitar a 1000 por seguridad
        log.info(f"Se encontraron {len(evaluaciones)} evaluaciones.")
        return evaluaciones
    except Exception as e:
        log.exception(f"Error al obtener todas las evaluaciones: {e}")
        if isinstance(e, sqlalchemy.exc.OperationalError):
             log.error("Error operacional al conectar a la BD para listar evaluaciones.")
             # Es importante no devolver detalles internos de la BD al cliente
             raise HTTPException(status_code=503, detail="Servicio de base de datos no disponible temporalmente.")
        # Error genérico para otros fallos
        raise HTTPException(status_code=500, detail="Error al consultar la base de datos.")

@app.get("/evaluaciones/{evaluacion_id}", response_model=EvaluacionDetailSchema)
def get_evaluacion_details(evaluacion_id: int, db: Session = Depends(get_db)):
    """Obtiene todos los detalles de una evaluación, incluyendo su resultado y archivos."""
    try:
        log.info(f"Solicitud GET /evaluaciones/{evaluacion_id}")
        # Usar joinedload para cargar relaciones eficientemente en una sola query
        evaluacion = db.query(Evaluacion)\
            .options(joinedload(Evaluacion.archivos_procesados), joinedload(Evaluacion.resultado_analisis))\
            .filter(Evaluacion.id == evaluacion_id).first()
        if not evaluacion:
            log.warning(f"Evaluación {evaluacion_id} no encontrada.")
            raise HTTPException(status_code=404, detail="Evaluación no encontrada.")
        # Ordenar los archivos procesados por nombre para consistencia
        if evaluacion.archivos_procesados:
             evaluacion.archivos_procesados.sort(key=lambda x: x.nombre_archivo_original)
        log.info(f"Detalles encontrados para evaluación {evaluacion_id}.")
        return evaluacion
    except HTTPException as http_exc:
        raise http_exc # Relanzar 404
    except Exception as e:
        log.exception(f"Error al obtener detalles de evaluación {evaluacion_id}: {e}")
        if isinstance(e, sqlalchemy.exc.OperationalError):
             log.error(f"Error operacional al conectar a la BD para detalles de {evaluacion_id}.")
             raise HTTPException(status_code=503, detail="Servicio de base de datos no disponible temporalmente.")
        raise HTTPException(status_code=500, detail="Error al consultar la base de datos.")

@app.get("/criterios")
def get_criterios(db: Session = Depends(get_db)):
    """Obtiene los criterios de calificación actuales."""
    default_criterios = {"aplicacion_conceptos": 0.4, "relacion_contextual": 0.3, "coherencia_logica": 0.3}
    try:
        log.info("Solicitud GET /criterios")
        criterios = db.query(CriterioConfig).all()
        if not criterios:
            log.info("No hay criterios en BD, devolviendo valores por defecto.")
            return default_criterios
        result = {c.nombre: c.peso for c in criterios}
        log.info(f"Criterios obtenidos de BD: {result}")
        return result
    except sqlalchemy.exc.OperationalError as db_op_err:
        # En caso de error de BD, devolver los defaults para que la app no falle completamente
        log.warning(f"Error operacional de BD al obtener criterios ({db_op_err}), devolviendo valores por defecto.")
        return default_criterios
    except Exception as e:
        log.exception(f"Error inesperado al obtener criterios: {e}")
        # Error grave, devolver 500
        raise HTTPException(status_code=500, detail="Error al consultar la base de datos de criterios.")

@app.post("/criterios")
def update_criterios(payload: CriterioConfigUpdate, db: Session = Depends(get_db)):
    """Actualiza los pesos de los criterios de calificación."""
    log.info(f"Solicitud POST /criterios con payload: {payload.model_dump()}")
    try:
        # Validación más precisa de la suma (usando tolerancia)
        total_peso = sum(payload.model_dump().values())
        if not (abs(total_peso - 1.0) < 1e-6): # Tolerancia pequeña para errores de punto flotante
            log.warning(f"Intento de actualizar criterios con suma de pesos inválida: {total_peso}")
            raise HTTPException(status_code=400, detail=f"La suma de los pesos debe ser 1 (actual: {total_peso:.4f}).")

        updated_count = 0
        added_count = 0
        # Iterar sobre los criterios definidos en el payload
        for nombre, peso in payload.model_dump().items():
            # Buscar criterio existente
            criterio = db.query(CriterioConfig).filter(CriterioConfig.nombre == nombre).with_for_update().first()
            if criterio:
                # Actualizar solo si el peso es diferente
                if criterio.peso != peso:
                    criterio.peso = peso
                    log.info(f"Actualizando peso de criterio '{nombre}' a {peso}")
                    updated_count += 1
            else:
                # Crear criterio si no existe
                criterio = CriterioConfig(nombre=nombre, peso=peso)
                db.add(criterio)
                log.info(f"Añadiendo nuevo criterio '{nombre}' con peso {peso}")
                added_count += 1

        # Commit solo si hubo cambios
        if updated_count > 0 or added_count > 0:
            db.commit()
            log.info(f"Criterios actualizados: {updated_count} actualizados, {added_count} añadidos.")
            message = "Criterios actualizados exitosamente."
        else:
            log.info("No hubo cambios en los pesos de los criterios.")
            message = "No se realizaron cambios en los criterios."

        return {"message": message}

    except HTTPException as http_exc:
        db.rollback() # Asegurar rollback en caso de error HTTP conocido (ej. 400)
        raise http_exc
    except sqlalchemy.exc.OperationalError as db_op_err:
        log.exception(f"Error operacional de BD al actualizar criterios: {db_op_err}")
        db.rollback()
        raise HTTPException(status_code=503, detail="Error temporal de base de datos, reintentar más tarde.")
    except Exception as e:
        log.exception(f"Error inesperado al actualizar criterios: {e}")
        db.rollback() # Rollback en caso de cualquier otro error
        raise HTTPException(status_code=500, detail="Error al actualizar criterios en la base de datos.")

