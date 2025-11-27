from pydantic import BaseModel, Field


class CursoBase(BaseModel):
    """Schema base para Curso"""
    nombre: str = Field(..., description="Nombre del curso", min_length=1)
    habilitado: bool = Field(default=True, description="Si el curso está habilitado")


class CursoCreate(CursoBase):
    """Schema para crear un curso"""
    pass


class CursoUpdate(BaseModel):
    """Schema para actualizar un curso"""
    nombre: str | None = None
    habilitado: bool | None = None


class CursoSchema(CursoBase):
    """Schema para devolver un curso"""
    id: int

    class Config:
        from_attributes = True
