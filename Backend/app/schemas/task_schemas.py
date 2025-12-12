from pydantic import BaseModel

class FileTaskPayload(BaseModel):
    gcs_filename: str
    original_filename: str
    evaluacion_id: int
    precomputed_ocr_text: str | None = None
    tipo_documento: str = "examen"

class EvaluationTaskPayload(BaseModel):
    evaluacion_id: int
