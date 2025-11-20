from pydantic import BaseModel, Field
from typing import List, Optional


class PDFFileInfo(BaseModel):
    """Información de un archivo PDF subido"""
    gcs_filename: str
    original_filename: str


class ExamBatchRequest(BaseModel):
    """Request para encolar un lote de exámenes"""
    pdf_files: List[PDFFileInfo]
    student_list: str
    rubrica_id: int = Field(..., description="ID de la rúbrica a usar")  # ✅ AGREGAR
    nombre_curso: str
    codigo_curso: str
    instructor: str
    semestre: str
    tema: str
    descripcion_tema: Optional[str] = None
    tipo_documento: str = Field(default="examen")

    class Config:
        json_schema_extra = {
            "example": {
                "pdf_files": [
                    {"gcs_filename": "abc-123.pdf", "original_filename": "examen1.pdf"}
                ],
                "student_list": "Juan Pérez\nMaría García",
                "rubrica_id": 1,  # ✅ EJEMPLO
                "nombre_curso": "Cálculo Avanzado",
                "codigo_curso": "CA-301",
                "instructor": "Prof. Turing",
                "semestre": "2025-1",
                "tema": "Examen Final",
                "tipo_documento": "examen"
            }
        }

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
