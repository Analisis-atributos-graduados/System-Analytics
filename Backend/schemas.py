from pydantic import BaseModel

class CriterioConfigUpdate(BaseModel):
    aplicacion_conceptos: float
    relacion_contextual: float
    coherencia_logica: float

    class Config:
        schema_extra = {
            "example": {
                "aplicacion_conceptos": 0.4,
                "relacion_contextual": 0.3,
                "coherencia_logica": 0.3
            }
        }