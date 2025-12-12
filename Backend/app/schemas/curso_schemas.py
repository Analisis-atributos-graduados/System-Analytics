from pydantic import BaseModel, Field


class CursoBase(BaseModel):
    nombre: str = Field(..., description="Nombre del curso", min_length=1)
    habilitado: bool = Field(default=True, description="Si el curso está habilitado")


class CursoCreate(CursoBase):
    pass


class CursoUpdate(BaseModel):
    nombre: str | None = None
    habilitado: bool | None = None


class CursoAtributoSchema(BaseModel):
    atributo_codigo: str
    class Config:
        from_attributes = True

class CursoSchema(CursoBase):
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
