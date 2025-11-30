from pydantic import BaseModel, Field, EmailStr


class UsuarioBase(BaseModel):
    """Schema base para Usuario"""
    email: EmailStr
    nombre: str = Field(..., min_length=1)
    rol: str = Field(..., pattern="^(PROFESOR|AREA_CALIDAD)$")


class UsuarioCreate(UsuarioBase):
    """Schema para crear un usuario (con firebase_uid)"""
    firebase_uid: str


class UsuarioCreateByAdmin(BaseModel):
    """Schema para que Admin cree un usuario (sin firebase_uid)"""
    email: EmailStr
    nombre: str = Field(..., min_length=1)
    rol: str = Field(..., pattern="^(PROFESOR|AREA_CALIDAD)$")
    password: str = Field(..., min_length=8, description="Contraseña inicial para el usuario")


class UsuarioUpdate(BaseModel):
    """Schema para actualizar un usuario"""
    nombre: str | None = None
    activo: bool | None = None


class UsuarioResponse(UsuarioBase):
    """Schema para devolver un usuario"""
    id: int
    activo: bool

    class Config:
        from_attributes = True
