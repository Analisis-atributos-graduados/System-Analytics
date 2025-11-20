from pydantic import BaseModel

class FileTaskPayload(BaseModel):
    """Payload para la tarea que procesa un único archivo (página de examen)."""
    gcs_filename: str
    original_filename: str
    evaluacion_id: int
    precomputed_ocr_text: str | None = None
    tipo_documento: str = "examen"

class EvaluationTaskPayload(BaseModel):
    """Payload para la tarea final que agrega resultados y califica una evaluación."""
    evaluacion_id: int
