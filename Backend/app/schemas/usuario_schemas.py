from pydantic import BaseModel, EmailStr, Field

class UsuarioCreate(BaseModel):
    """Schema para crear un usuario después del registro en Firebase."""
    firebase_uid: str = Field(..., description="UID de Firebase Auth")
    email: EmailStr
    nombre: str
    rol: str = Field(..., description="PROFESOR o AREA_CALIDAD")


class UsuarioResponse(BaseModel):
    """Schema para devolver información de usuario."""
    id: int
    firebase_uid: str
    email: str
    nombre: str
    rol: str
    activo: bool

    class Config:
        from_attributes = True


class UsuarioLogin(BaseModel):
    """Schema para login (solo se usa el token de Firebase en realidad)."""
    firebase_token: str
