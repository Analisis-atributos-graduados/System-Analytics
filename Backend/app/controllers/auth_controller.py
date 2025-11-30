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
    Completa el registro de un usuario pre-autorizado.
    
    Flujo:
    1. Usuario pre-registrado en BD por Admin (firebase_uid='pending:{email}')
    2. Usuario se autentica en Firebase (frontend)
    3. Frontend obtiene firebase_uid real
    4. Frontend llama a este endpoint
    5. Backend actualiza firebase_uid si el email está pre-registrado
    """
    try:
        usuario_repo = UsuarioRepository(db)

        # Buscar por email (debe existir, creado por admin)
        existing_user = usuario_repo.get_by_email(user_data.email)
        
        if not existing_user:
            # Usuario NO está pre-registrado -> Denegar acceso
            log.warning(f"Intento de registro no autorizado: {user_data.email}")
            raise HTTPException(
                status_code=403, 
                detail="Acceso denegado. Contacta al administrador para obtener acceso al sistema."
            )
        
        # Usuario existe -> Verificar si ya completó registro
        if existing_user.firebase_uid and not existing_user.firebase_uid.startswith('pending:'):
            # Ya tiene UID real -> Ya registrado previamente
            if existing_user.firebase_uid == user_data.firebase_uid:
                log.info(f"Usuario ya registrado: {user_data.email}")
                return existing_user
            else:
                raise HTTPException(
                    status_code=400, 
                    detail="Este email ya está asociado a otra cuenta"
                )
        
        # Usuario pre-registrado -> Actualizar con UID real de Firebase
        existing_user.firebase_uid = user_data.firebase_uid
        db.commit()
        db.refresh(existing_user)
        
        log.info(f"Usuario completó registro: {existing_user.email} ({existing_user.rol})")
        return existing_user

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
