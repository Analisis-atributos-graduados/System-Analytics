from pydantic import BaseModel, Field, EmailStr


class UsuarioBase(BaseModel):
    email: EmailStr
    nombre: str = Field(..., min_length=1)
    rol: str = Field(..., pattern="^(PROFESOR|AREA_CALIDAD)$")


class UsuarioCreate(UsuarioBase):
    firebase_uid: str


class UsuarioCreateByAdmin(BaseModel):
    email: EmailStr
    nombre: str = Field(..., min_length=1)
    rol: str = Field(..., pattern="^(PROFESOR|AREA_CALIDAD)$")
    password: str = Field(..., min_length=8, description="Contraseña inicial para el usuario")


class UsuarioUpdate(BaseModel):
    nombre: str | None = None
    activo: bool | None = None


class UsuarioResponse(UsuarioBase):
    id: int
    activo: bool

    class Config:
        from_attributes = True
