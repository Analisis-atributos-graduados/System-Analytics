from pydantic import BaseModel, Field, field_validator
from typing import List, Optional

class NivelSchema(BaseModel):

    nombre_nivel: str = Field(..., description="Nombre del nivel, ej: 'Excelente', 'Bueno', 'Regular', 'Insuficiente'")
    puntaje: float = Field(..., ge=0, description="Puntaje de este nivel")
    descriptores: List[str] = Field(default_factory=list, description="Lista de descriptores que definen este nivel")
    orden: int = Field(default=0, description="Orden de presentación del nivel")

    class Config:
        json_schema_extra = {
            "example": {
                "nombre_nivel": "Excelente",
                "puntaje": 5,
                "descriptores": [
                    "Justifica las necesidades y/o problemática",
                    "Describe las causas más probables",
                    "Presenta información relevante"
                ],
                "orden": 1
            }
        }


class NivelDetailSchema(NivelSchema):

    id: int
    criterio_id: int

    class Config:
        from_attributes = True


class CriterioCreateSchema(BaseModel):

    nombre_criterio: str = Field(..., description="Nombre del criterio a evaluar")
    descripcion_criterio: str = Field(default="", description="Descripción detallada del criterio")
    orden: int = Field(default=0, description="Orden de presentación")
    niveles: List[NivelSchema] = Field(..., min_length=1, description="Debe tener al menos un nivel de desempeño")

    @field_validator('niveles')
    def validate_niveles(cls, v):
        if not v or len(v) == 0:
            raise ValueError('Debe definir al menos un nivel')
        return v


class CriterioDetailSchema(BaseModel):

    id: int
    rubrica_id: int
    nombre_criterio: str
    descripcion_criterio: Optional[str]
    orden: int
    niveles: List[NivelDetailSchema]

    class Config:
        from_attributes = True


class RubricaCreateRequest(BaseModel):

    nombre_rubrica: str = Field(..., description="Nombre descriptivo de la rúbrica")
    descripcion: str = Field(default="", description="Descripción del propósito de la rúbrica")
    nrc_id: Optional[int] = Field(default=None, description="NRC al que se asocia la rúbrica")
    criterios: List[CriterioCreateSchema] = Field(..., min_length=1, description="Debe tener al menos un criterio")

    @field_validator('criterios')
    def validate_criterios(cls, v):
        if not v or len(v) == 0:
            raise ValueError('Debe definir al menos un criterio')

        total_puntos = 0.0
        for c in v:
            if not c.niveles:
                raise ValueError(f'El criterio "{c.nombre_criterio}" debe tener al menos un nivel')
            total_puntos += max(nivel.puntaje for nivel in c.niveles)

        if abs(total_puntos - 20.0) > 0.01:
            raise ValueError(f'La suma de los puntajes máximos de los criterios debe ser exactamente 20.0 (actual: {total_puntos:.2f})')

        return v


class RubricaDetailSchema(BaseModel):
    id: int
    nombre_rubrica: str
    descripcion: Optional[str]
    nrc_id: Optional[int] = None
    estado_ciac: str
    mensaje_ciac: Optional[str] = None
    estado_director: str
    mensaje_director: Optional[str] = None
    criterios: List[CriterioDetailSchema]

    class Config:
        from_attributes = True


class RubricaListSchema(BaseModel):
    id: int
    nombre_rubrica: str
    descripcion: Optional[str]
    nrc_id: Optional[int] = None
    estado_ciac: str
    mensaje_ciac: Optional[str] = None
    estado_director: str
    mensaje_director: Optional[str] = None
    criterios: List[CriterioDetailSchema] = []

    class Config:
        from_attributes = True


class RubricaRevisionSchema(BaseModel):
    aprobado: bool
    mensaje: Optional[str] = None

