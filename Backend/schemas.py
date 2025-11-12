from pydantic import BaseModel, Field
from typing import List


# --- Modelo para actualizar Criterios ---
# Usado por el endpoint: POST /criterios
class CriterioConfigUpdate(BaseModel):
    """Define la estructura para actualizar los pesos de los criterios de evaluación."""
    aplicacion_conceptos: float = Field(..., ge=0, le=1, description="Peso para el criterio 'aplicación de conceptos'.")
    relacion_contextual: float = Field(..., ge=0, le=1, description="Peso para el criterio 'relación contextual'.")
    coherencia_logica: float = Field(..., ge=0, le=1, description="Peso para el criterio 'coherencia lógica'.")

    class Config:
        json_schema_extra = {
            "example": {
                "aplicacion_conceptos": 0.4,
                "relacion_contextual": 0.3,
                "coherencia_logica": 0.3
            }
        }


# --- Modelo para generar URLs de subida ---
# Usado por el endpoint: POST /generate-upload-url
class GenerateUploadURLRequest(BaseModel):
    """Define la estructura para solicitar una URL de subida a Google Cloud Storage."""
    filename: str = Field(..., description="Nombre del archivo que se va a subir.")
    content_type: str = Field(..., description="Tipo MIME del archivo (ej. 'application/pdf').")

    class Config:
        json_schema_extra = {
            "example": {
                "filename": "examen_cara_1.pdf",
                "content_type": "application/pdf"
            }
        }


# --- Modelos para el procesamiento por lotes de exámenes ---

class PDFFileInfo(BaseModel):
    """Describe la información de un solo PDF subido a GCS."""
    gcs_filename: str = Field(..., description="El nombre único del archivo en Google Cloud Storage.")
    original_filename: str = Field(..., description="El nombre original del archivo que subió el usuario.")


# Usado por el endpoint: POST /enqueue-exam-batch
class ExamBatchRequest(BaseModel):
    """Define el 'contrato' completo para iniciar el procesamiento de un lote de exámenes."""
    pdf_files: List[PDFFileInfo] = Field(..., description="Una lista de los PDFs de examen subidos a GCS.")
    student_list: str = Field(..., description="Una cadena de texto con la lista de nombres de alumnos, uno por línea.")

    # Metadatos del curso
    nombre_curso: str
    codigo_curso: str
    instructor: str
    semestre: str
    tema: str
    descripcion_tema: str | None = None
    tipo_documento: str = Field(default="examen", description="Tipo: 'examen' o 'ensayo/informe'")

    class Config:
        json_schema_extra = {
            "example": {
                "pdf_files": [
                    {"gcs_filename": "uuid-xyz-caras_impares_1.pdf", "original_filename": "caras_impares_1.pdf"},
                    {"gcs_filename": "uuid-abc-caras_pares_2.pdf", "original_filename": "caras_pares_2.pdf"}
                ],
                "student_list": "Juan Perez\nMaria Rodriguez\nCarlos Sanchez",
                "nombre_curso": "Cálculo Avanzado",
                "codigo_curso": "CA-301",
                "instructor": "Prof. Alan Turing",
                "semestre": "2025-2",
                "tema": "Examen Final - Derivadas e Integrales",
                "descripcion_tema": "Evaluación final del curso.",
                "tipo_documento": "examen"
            }
        }


# --- Modelos para los workers internos de Cloud Tasks ---
# Estos no son llamados por el usuario, pero definirlos es una buena práctica.

# Usado por el endpoint: POST /process-file-task
class FileTaskPayload(BaseModel):
    """Payload para la tarea que procesa un único archivo (página de examen)."""
    gcs_filename: str
    original_filename: str
    evaluacion_id: int
    precomputed_ocr_text: str | None = None
    tipo_documento: str = "examen"


# Usado por el endpoint: POST /process-evaluation-task
class EvaluationTaskPayload(BaseModel):
    """Payload para la tarea final que agrega resultados y califica una evaluación."""
    evaluacion_id: int


# --- Modelos para la consulta de detalles de Evaluación ---

class ResultadoAnalisisSchema(BaseModel):
    """Schema para mostrar los resultados del análisis de una evaluación."""
    id: int
    aplicacion_conceptos: float
    relacion_contextual: float
    coherencia_logica: float
    nota_final: float

    class Config:
        from_attributes = True


class ArchivoProcesadoSchema(BaseModel):
    """Schema para mostrar los detalles de un archivo procesado."""
    id: int
    nombre_archivo_original: str
    texto_extraido: str | None = None

    class Config:
        from_attributes = True


class EvaluacionSchema(BaseModel):
    """Schema para listar evaluaciones (sin detalles anidados)."""
    id: int
    nombre_alumno: str
    nombre_curso: str
    codigo_curso: str
    instructor: str
    semestre: str
    tema: str

    class Config:
        from_attributes = True


class EvaluacionDetailSchema(BaseModel):
    """Schema completo para devolver los detalles de una evaluación."""
    id: int
    nombre_alumno: str
    nombre_curso: str
    codigo_curso: str
    instructor: str
    semestre: str
    tema: str
    descripcion_tema: str | None = None
    archivos_procesados: List[ArchivoProcesadoSchema] = []
    resultado_analisis: ResultadoAnalisisSchema | None = None

    class Config:
        from_attributes = True

