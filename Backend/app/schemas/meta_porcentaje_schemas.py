from pydantic import BaseModel, Field


class MetaPorcentajeSchema(BaseModel):
    id: int
    porcentaje: int = Field(..., ge=0, le=100, description="Porcentaje objetivo (0-100)")

    class Config:
        from_attributes = True


class MetaPorcentajeUpdate(BaseModel):
    porcentaje: int = Field(..., ge=0, le=100, description="Porcentaje objetivo (0-100)")
