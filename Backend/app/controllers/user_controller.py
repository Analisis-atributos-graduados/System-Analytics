import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from firebase_admin import auth

from app.models import get_db, Usuario
from app.schemas.usuario_schemas import UsuarioCreateByAdmin, UsuarioResponse, UsuarioUpdate
from app.repositories import UsuarioRepository
from app.config.dependencies import require_role

log = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["Gestión de Usuarios"])


@router.post("/", response_model=UsuarioResponse)
async def create_user(
    user_data: UsuarioCreateByAdmin,
    current_user: Usuario = Depends(require_role("AREA_CALIDAD")),
    db: Session = Depends(get_db)
):
    """
    Crea un nuevo usuario (solo Admin/Área de Calidad).
    Crea el usuario en Firebase Auth con contraseña y luego en la BD local.
    """
    try:
        usuario_repo = UsuarioRepository(db)

        # Verificar que el email no exista en BD local
        existing = usuario_repo.get_by_email(user_data.email)
        if existing:
            raise HTTPException(status_code=400, detail="El email ya está registrado")

        # Crear usuario en Firebase Auth
        try:
            firebase_user = auth.create_user(
                email=user_data.email,
                password=user_data.password,
                display_name=user_data.nombre,
                email_verified=True  # IMPORTANTE: Marcar como verificado para evitar que Google sobrescriba la cuenta
            )
            log.info(f"Usuario creado en Firebase: {firebase_user.uid}")
        except auth.EmailAlreadyExistsError:
            try:
                # Intenta obtener el usuario existente de Firebase
                existing_firebase_user = auth.get_user_by_email(user_data.email)
                
                # Check if the existing user has a password provider
                # provider_data is a list of UserInfo objects
                has_password_provider = any(provider.provider_id == 'password' for provider in existing_firebase_user.provider_data)

                if has_password_provider:
                    # If it already has an email/password, then it's a conflict
                    db.rollback()
                    raise HTTPException(status_code=400, detail="El email ya está registrado como usuario de email/contraseña.")
                else:
                    # If it does NOT have a password provider, it means it's likely a Google-only user
                    # We can update this existing Firebase user with a password
                    firebase_user = auth.update_user(
                        uid=existing_firebase_user.uid,
                        password=user_data.password,
                        display_name=user_data.nombre # Update display name if different
                    )
                    log.info(f"Usuario existente {firebase_user.email} ({firebase_user.uid}) actualizado en Firebase con contraseña.")

            except Exception as e:
                db.rollback()
                log.error(f"Error al manejar email existente en Firebase: {e}")
                raise HTTPException(status_code=500, detail=f"Error al procesar email existente en Firebase: {str(e)}")
        except Exception as e:
            db.rollback()
            log.error(f"Error al crear usuario en Firebase: {e}")
            raise HTTPException(status_code=500, detail=f"Error al crear usuario en Firebase: {str(e)}")

        # Crear usuario en BD local con el UID real de Firebase
        usuario = usuario_repo.create_usuario(
            firebase_uid=firebase_user.uid,
            email=user_data.email,
            nombre=user_data.nombre,
            rol=user_data.rol
        )
        db.commit()
        db.refresh(usuario)

        log.info(f"Usuario creado por {current_user.email}: {usuario.email} ({usuario.rol})")
        return usuario

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error al crear usuario: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[UsuarioResponse])
async def list_users(
    current_user: Usuario = Depends(require_role("AREA_CALIDAD")),
    db: Session = Depends(get_db)
):
    """
    Lista todos los usuarios (solo Admin/Área de Calidad).
    """
    try:
        usuario_repo = UsuarioRepository(db)
        usuarios = usuario_repo.get_all_usuarios()
        
        log.info(f"Listando {len(usuarios)} usuarios")
        return usuarios

    except Exception as e:
        log.error(f"Error al listar usuarios: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{usuario_id}", response_model=UsuarioResponse)
async def update_user(
    usuario_id: int,
    user_data: UsuarioUpdate,
    current_user: Usuario = Depends(require_role("AREA_CALIDAD")),
    db: Session = Depends(get_db)
):
    """
    Actualiza un usuario (solo Admin/Área de Calidad).
    """
    try:
        usuario_repo = UsuarioRepository(db)
        
        usuario = usuario_repo.get_by_id(usuario_id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        # Actualizar solo los campos proporcionados
        if user_data.nombre is not None:
            usuario.nombre = user_data.nombre
        if user_data.activo is not None:
            usuario.activo = user_data.activo

        db.commit()
        db.refresh(usuario)

        log.info(f"Usuario actualizado por {current_user.email}: {usuario.email}")
        return usuario

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error al actualizar usuario: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{usuario_id}")
async def delete_user(
    usuario_id: int,
    current_user: Usuario = Depends(require_role("AREA_CALIDAD")),
    db: Session = Depends(get_db)
):
    """
    Elimina un usuario (solo Admin/Área de Calidad).
    """
    try:
        usuario_repo = UsuarioRepository(db)
        
        usuario = usuario_repo.get_by_id(usuario_id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        # No permitir que el admin se elimine a sí mismo
        if usuario.id == current_user.id:
            raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")

        # Eliminar usuario de Firebase Auth
        try:
            auth.delete_user(usuario.firebase_uid)
            log.info(f"Usuario {usuario.email} ({usuario.firebase_uid}) eliminado de Firebase Auth")
        except auth.UserNotFoundError:
            log.warning(f"Usuario {usuario.email} ({usuario.firebase_uid}) no encontrado en Firebase Auth, continuando con eliminación local.")
            # Continuar porque el objetivo es eliminarlo localmente de todos modos
        except Exception as e:
            log.error(f"Error al eliminar usuario {usuario.email} ({usuario.firebase_uid}) de Firebase Auth: {e}")
            raise HTTPException(status_code=500, detail=f"Error al eliminar usuario de Firebase: {str(e)}")

        db.delete(usuario)
        db.commit()

        log.info(f"Usuario eliminado por {current_user.email}: {usuario.email}")
        return {"success": True, "message": "Usuario eliminado correctamente"}

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error al eliminar usuario: {e}")
        raise HTTPException(status_code=500, detail=str(e))
