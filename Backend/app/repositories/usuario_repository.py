import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models import Usuario
from app.repositories.base_repository import BaseRepository

log = logging.getLogger(__name__)


class UsuarioRepository(BaseRepository):
    """
    Repositorio para operaciones con usuarios.
    """

    def __init__(self, db: Session):
        super().__init__(db, Usuario)

    def get_by_firebase_uid(self, firebase_uid: str) -> Optional[Usuario]:
        """
        Obtiene un usuario por su Firebase UID.

        Args:
            firebase_uid: UID de Firebase del usuario

        Returns:
            Usuario encontrado o None
        """
        try:
            return self.db.query(Usuario).filter(Usuario.firebase_uid == firebase_uid).first()
        except Exception as e:
            log.error(f"Error al obtener usuario por firebase_uid: {e}")
            raise

    def get_by_email(self, email: str) -> Optional[Usuario]:
        """
        Obtiene un usuario por su email.

        Args:
            email: Email del usuario

        Returns:
            Usuario encontrado o None
        """
        try:
            return self.db.query(Usuario).filter(Usuario.email == email).first()
        except Exception as e:
            log.error(f"Error al obtener usuario por email: {e}")
            raise

    def create_usuario(
            self,
            firebase_uid: str,
            email: str,
            nombre: str,
            rol: str
    ) -> Usuario:
        """
        Crea un nuevo usuario.

        Args:
            firebase_uid: UID de Firebase
            email: Email del usuario
            nombre: Nombre completo
            rol: Rol del usuario (PROFESOR o AREA_CALIDAD)

        Returns:
            Usuario creado
        """
        try:
            usuario = Usuario(
                firebase_uid=firebase_uid,
                email=email,
                nombre=nombre,
                rol=rol,
                activo=True
            )

            self.db.add(usuario)
            self.db.commit()
            self.db.refresh(usuario)

            log.info(f"Usuario creado: {email} ({rol})")
            return usuario

        except Exception as e:
            log.error(f"Error al crear usuario: {e}")
            self.db.rollback()
            raise
