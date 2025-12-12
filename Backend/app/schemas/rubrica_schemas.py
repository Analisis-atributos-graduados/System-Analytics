from pydantic import BaseModel, Field, field_validator
from typing import List, Optional

class NivelSchema(BaseModel):

    nombre_nivel: str = Field(..., description="Nombre del nivel, ej: 'Excelente', 'Bueno', 'Regular', 'Insuficiente'")
    puntaje_min: float = Field(..., ge=0, description="Puntaje mínimo del rango")
    puntaje_max: float = Field(..., ge=0, description="Puntaje máximo del rango")
    descriptores: List[str] = Field(default_factory=list, description="Lista de descriptores que definen este nivel")
    orden: int = Field(default=0, description="Orden de presentación del nivel")

    class Config:
        json_schema_extra = {
            "example": {
                "nombre_nivel": "Excelente",
                "puntaje_min": 3,
                "puntaje_max": 3,
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
    peso: float = Field(..., ge=0, le=1, description="Peso del criterio en la nota final (0-1)")
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
    peso: float
    orden: int
    niveles: List[NivelDetailSchema]

    class Config:
        from_attributes = True


class RubricaCreateRequest(BaseModel):

    nombre_rubrica: str = Field(..., description="Nombre descriptivo de la rúbrica")
    descripcion: str = Field(default="", description="Descripción del propósito de la rúbrica")
    criterios: List[CriterioCreateSchema] = Field(..., min_length=1, description="Debe tener al menos un criterio")

    @field_validator('criterios')
    def validate_criterios(cls, v):
        if not v or len(v) == 0:
            raise ValueError('Debe definir al menos un criterio')

        suma_pesos = sum(c.peso for c in v)
        if abs(suma_pesos - 1.0) > 0.01:
            raise ValueError(f'La suma de los pesos debe ser 1.0 (actual: {suma_pesos:.2f})')

        return v


class RubricaDetailSchema(BaseModel):
    id: int
    profesor_id: int
    nombre_rubrica: str
    descripcion: Optional[str]
    activo: bool
    criterios: List[CriterioDetailSchema]

    class Config:
        from_attributes = True


class RubricaListSchema(BaseModel):
    id: int
    nombre_rubrica: str
    descripcion: Optional[str]
    activo: bool
    criterios: List[CriterioDetailSchema] = []

    class Config:
        from_attributes = True
