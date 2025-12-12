from pydantic import BaseModel, Field
from typing import List, Optional


class PDFFileInfo(BaseModel):
    gcs_filename: str
    original_filename: str


class ExamBatchRequest(BaseModel):
    pdf_files: List[PDFFileInfo]
    student_list: str
    rubrica_id: int = Field(..., description="ID de la rúbrica a usar")
    curso_id: int = Field(..., description="ID del curso")
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
                "student_list": "Juan Pérez\\nMaría García",
                "rubrica_id": 1,
                "curso_id": 1,
                "codigo_curso": "3012-A",
                "instructor": "Prof. Turing",
                "semestre": "2025-1",
                "tema": "Examen Final",
                "tipo_documento": "examen"
            }
        }

class ResultadoAnalisisSchema(BaseModel):
    id: int
    aplicacion_conceptos: float | None = None
    relacion_contextual: float | None = None
    coherencia_logica: float | None = None
    nota_final: float

    class Config:
        from_attributes = True


class ArchivoProcesadoSchema(BaseModel):
    id: int
    nombre_archivo_original: str
    texto_extraido: str | None = None

    class Config:
        from_attributes = True


class CursoSimpleSchema(BaseModel):
    id: int
    nombre: str
    
    class Config:
        from_attributes = True


class EvaluacionSchema(BaseModel):
    id: int
    nombre_alumno: str
    curso: CursoSimpleSchema
    codigo_curso: str
    instructor: str
    semestre: str
    tema: str

    class Config:
        from_attributes = True


class EvaluacionDetailSchema(BaseModel):
    id: int
    nombre_alumno: str
    curso: CursoSimpleSchema
    codigo_curso: str
    instructor: str
    semestre: str
    tema: str
    descripcion_tema: str | None = None
    archivos_procesados: List[ArchivoProcesadoSchema] = []
    resultado_analisis: ResultadoAnalisisSchema | None = None

    class Config:
        from_attributes = True


class QualityDashboardStats(BaseModel):
    total_alumnos: int
    porcentaje_logro: float
    criterios: List[dict]
