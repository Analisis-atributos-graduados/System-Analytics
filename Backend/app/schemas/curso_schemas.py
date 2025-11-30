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


class CursoAtributoSchema(BaseModel):
    atributo_codigo: str
    class Config:
        from_attributes = True

class CursoSchema(CursoBase):
    """Schema para devolver un curso"""
    id: int
    atributos: list[CursoAtributoSchema] = []

    class Config:
        from_attributes = True


class AttributeAssignmentSchema(BaseModel):
    atributo: str
    cursos: list[int]


class BulkAttributeAssignmentSchema(BaseModel):
    meta: int
    asignaciones: list[AttributeAssignmentSchema]
