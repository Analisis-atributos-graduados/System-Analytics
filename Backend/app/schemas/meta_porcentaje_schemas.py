from pydantic import BaseModel, Field


class MetaPorcentajeSchema(BaseModel):
    """Schema para la meta de porcentaje"""
    id: int
    porcentaje: int = Field(..., ge=0, le=100, description="Porcentaje objetivo (0-100)")

    class Config:
        from_attributes = True


class MetaPorcentajeUpdate(BaseModel):
    """Schema para actualizar la meta de porcentaje"""
    porcentaje: int = Field(..., ge=0, le=100, description="Porcentaje objetivo (0-100)")
