from pydantic import BaseModel, Field


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
