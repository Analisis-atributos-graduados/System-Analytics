from pydantic import BaseModel, Field, EmailStr
from typing import List


class UsuarioBase(BaseModel):
    email: EmailStr
    nombre: str = Field(..., min_length=1)
    rol: str = Field(..., pattern="^(PROFESOR|DOCENTE_CIAC|DIRECTOR_ESCUELA|COMITE_ACADEMICO|DIRAC|ADMINISTRADOR)(,(PROFESOR|DOCENTE_CIAC|DIRECTOR_ESCUELA|COMITE_ACADEMICO|DIRAC|ADMINISTRADOR))*$")


class UsuarioCreate(UsuarioBase):
    firebase_uid: str


class UsuarioCreateByAdmin(BaseModel):
    email: EmailStr
    nombre: str = Field(..., min_length=1)
    rol: str = Field(..., pattern="^(PROFESOR|DOCENTE_CIAC|DIRECTOR_ESCUELA|COMITE_ACADEMICO|DIRAC|ADMINISTRADOR)(,(PROFESOR|DOCENTE_CIAC|DIRECTOR_ESCUELA|COMITE_ACADEMICO|DIRAC|ADMINISTRADOR))*$")
    password: str = Field(..., min_length=8, description="Contraseña inicial para el usuario")


class UsuarioUpdate(BaseModel):
    nombre: str | None = None
    activo: bool | None = None


class UsuarioResponse(UsuarioBase):
    id: int
    activo: bool
    roles: List[str] = []

    class Config:
        from_attributes = True
