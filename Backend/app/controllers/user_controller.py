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


@router.post("", response_model=UsuarioResponse)
async def create_user(
    user_data: UsuarioCreateByAdmin,
    current_user: Usuario = Depends(require_role("AREA_CALIDAD")),
    db: Session = Depends(get_db)
):

    try:
        usuario_repo = UsuarioRepository(db)

        existing = usuario_repo.get_by_email(user_data.email)
        if existing:
            raise HTTPException(status_code=400, detail="El email ya está registrado")

        try:
            firebase_user = auth.create_user(
                email=user_data.email,
                password=user_data.password,
                display_name=user_data.nombre,
                email_verified=True
            )
            log.info(f"Usuario creado en Firebase: {firebase_user.uid}")
        except auth.EmailAlreadyExistsError:
            try:
                existing_firebase_user = auth.get_user_by_email(user_data.email)

                has_password_provider = any(provider.provider_id == 'password' for provider in existing_firebase_user.provider_data)

                if has_password_provider:
                    db.rollback()
                    raise HTTPException(status_code=400, detail="El email ya está registrado como usuario de email/contraseña.")
                else:
                    firebase_user = auth.update_user(
                        uid=existing_firebase_user.uid,
                        password=user_data.password,
                        display_name=user_data.nombre
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


@router.get("", response_model=List[UsuarioResponse])
async def list_users(
    current_user: Usuario = Depends(require_role("AREA_CALIDAD")),
    db: Session = Depends(get_db)
):

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

    try:
        usuario_repo = UsuarioRepository(db)
        
        usuario = usuario_repo.get_by_id(usuario_id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

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

    try:
        usuario_repo = UsuarioRepository(db)
        
        usuario = usuario_repo.get_by_id(usuario_id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        if usuario.id == current_user.id:
            raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")

        try:
            auth.delete_user(usuario.firebase_uid)
            log.info(f"Usuario {usuario.email} ({usuario.firebase_uid}) eliminado de Firebase Auth")
        except auth.UserNotFoundError:
            log.warning(f"Usuario {usuario.email} ({usuario.firebase_uid}) no encontrado en Firebase Auth, continuando con eliminación local.")

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
