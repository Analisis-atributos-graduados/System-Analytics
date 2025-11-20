import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models import get_db, Usuario
from app.schemas import UsuarioCreate, UsuarioResponse
from app.repositories import UsuarioRepository
from app.config.dependencies import get_current_user

log = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/register", response_model=UsuarioResponse)
async def register_user(
        user_data: UsuarioCreate,
        db: Session = Depends(get_db)
):
    """
    Registra un usuario en el sistema después de autenticarse con Firebase.

    Flujo:
    1. Usuario se registra en Firebase (frontend)
    2. Frontend obtiene firebase_uid
    3. Frontend llama a este endpoint con los datos
    """
    try:
        usuario_repo = UsuarioRepository(db)

        # Verificar que no exista ya
        existing = usuario_repo.get_by_firebase_uid(user_data.firebase_uid)
        if existing:
            raise HTTPException(status_code=400, detail="Usuario ya registrado")

        # Verificar email único
        existing_email = usuario_repo.get_by_email(user_data.email)
        if existing_email:
            raise HTTPException(status_code=400, detail="Email ya registrado")

        # Validar rol
        if user_data.rol not in ["PROFESOR", "AREA_CALIDAD"]:
            raise HTTPException(status_code=400, detail="Rol inválido")

        # Crear usuario
        usuario = usuario_repo.create_usuario(
            firebase_uid=user_data.firebase_uid,
            email=user_data.email,
            nombre=user_data.nombre,
            rol=user_data.rol
        )

        log.info(f"Usuario registrado: {usuario.email} ({usuario.rol})")
        return usuario

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error al registrar usuario: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me", response_model=UsuarioResponse)
async def get_current_user_info(
        current_user: Usuario = Depends(get_current_user)
):
    """
    Obtiene información del usuario actual (autenticado).
    """
    return current_user
