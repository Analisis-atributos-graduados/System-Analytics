import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from firebase_admin import auth
from pydantic import BaseModel, EmailStr

from app.models import get_db, Usuario
from app.schemas.usuario_schemas import UsuarioCreateByAdmin, UsuarioResponse, UsuarioUpdate
from app.repositories import UsuarioRepository
from app.config.dependencies import require_role

log = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["Gestión de Usuarios"])


@router.post("", response_model=UsuarioResponse)
async def create_user(
    user_data: UsuarioCreateByAdmin,
    current_user: Usuario = Depends(require_role("ADMINISTRADOR", "DIRAC")),
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
    current_user: Usuario = Depends(require_role("ADMINISTRADOR", "DIRAC")),
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
    current_user: Usuario = Depends(require_role("ADMINISTRADOR", "DIRAC")),
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
    current_user: Usuario = Depends(require_role("ADMINISTRADOR", "DIRAC")),
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


class UpdateUserRoles(BaseModel):
    email: EmailStr
    nombre: str
    roles: List[str]


@router.get("/profesores")
async def list_profesores(
    current_user: Usuario = Depends(require_role("ADMINISTRADOR", "DIRAC")),
    db: Session = Depends(get_db)
):
    try:
        from app.models.profesor import Profesor
        profesores = db.query(Profesor).order_by(Profesor.apellidos.asc(), Profesor.nombres.asc()).all()

        usuario_repo = UsuarioRepository(db)
        usuarios = usuario_repo.get_all_usuarios()
        usuarios_map = {u.email.lower().strip(): u for u in usuarios}

        result = []
        for p in profesores:
            email_key = p.correo.lower().strip()
            user_rec = usuarios_map.get(email_key)

            result.append({
                "email": p.correo,
                "nombre": f"{p.nombres} {p.apellidos}".strip(),
                "roles": user_rec.roles if user_rec else [],
                "is_registered": user_rec is not None and not user_rec.firebase_uid.startswith('pending:'),
                "user_id": user_rec.id if user_rec else None
            })

        profesores_emails = {p.correo.lower().strip() for p in profesores}
        for email_key, u in usuarios_map.items():
            if email_key not in profesores_emails:
                result.append({
                    "email": u.email,
                    "nombre": u.nombre,
                    "roles": u.roles,
                    "is_registered": not u.firebase_uid.startswith('pending:'),
                    "user_id": u.id
                })

        return result
    except Exception as e:
        log.error(f"Error al listar profesores y usuarios: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update-roles")
async def update_user_roles(
    payload: UpdateUserRoles,
    current_user: Usuario = Depends(require_role("ADMINISTRADOR", "DIRAC")),
    db: Session = Depends(get_db)
):
    try:
        usuario_repo = UsuarioRepository(db)
        existing = usuario_repo.get_by_email(payload.email)

        rol = getattr(current_user, 'active_role', current_user.rol)
        if rol == "DIRAC":
            if "ADMINISTRADOR" in payload.roles:
                raise HTTPException(status_code=403, detail="DIRAC no puede asignar el rol de ADMINISTRADOR")
            if existing and "ADMINISTRADOR" in existing.roles:
                if "ADMINISTRADOR" not in payload.roles:
                    payload.roles.append("ADMINISTRADOR")

        roles_list = [r.strip() for r in payload.roles if r.strip()]

        if not roles_list:
            if existing:
                try:
                    if not existing.firebase_uid.startswith('pending:'):
                        auth.delete_user(existing.firebase_uid)
                except Exception as ex:
                    log.warning(f"Error al borrar de Firebase Auth: {ex}")

                db.delete(existing)
                db.commit()
                return {"message": "Usuario eliminado por no tener roles asignados", "deleted": True}
            return {"message": "Usuario no existe y no tiene roles asignados", "deleted": True}

        rol_str = ",".join(roles_list)

        if existing:
            existing.rol = rol_str
            existing.activo = True
            db.commit()
            db.refresh(existing)
            return {"message": "Roles actualizados correctamente", "user": {"email": existing.email, "roles": existing.roles}}
        else:
            new_user = usuario_repo.create_usuario(
                firebase_uid=f"pending:{payload.email}",
                email=payload.email,
                nombre=payload.nombre,
                rol=rol_str
            )
            db.commit()
            db.refresh(new_user)
            return {"message": "Usuario creado con roles asignados", "user": {"email": new_user.email, "roles": new_user.roles}}
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error al actualizar roles: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
