import logging
from fastapi import HTTPException, status
import firebase_admin
from firebase_admin import credentials, auth
import os

log = logging.getLogger(__name__)


class FirebaseAuth:
    """Manejo de autenticación con Firebase."""

    _initialized = False

    @classmethod
    def initialize(cls):
        """Inicializa Firebase Admin SDK (solo una vez)."""
        if cls._initialized:
            return

        try:
            # Intentar usar credenciales de archivo (desarrollo local)
            cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "credentials.json")
            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
                log.info("Firebase inicializado con archivo de credenciales")
            else:
                # Usar credenciales por defecto (Cloud Run)
                firebase_admin.initialize_app()
                log.info("Firebase inicializado con credenciales por defecto")

            cls._initialized = True
        except Exception as e:
            log.error(f"Error al inicializar Firebase: {e}")
            # No lanzar excepción aquí, dejar que falle en verify_token

    @staticmethod
    def verify_token(token: str) -> dict:
        """
        Verifica el token de Firebase y devuelve los datos del usuario.

        Args:
            token: ID Token de Firebase

        Returns:
            dict con: uid, email, name

        Raises:
            HTTPException: Si el token es inválido
        """
        try:
            # Verificar token con Firebase
            decoded_token = auth.verify_id_token(token)

            return {
                "uid": decoded_token.get("uid"),
                "email": decoded_token.get("email"),
                "name": decoded_token.get("name", "")
            }

        except auth.InvalidIdTokenError:
            log.error("Token de Firebase inválido")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido"
            )
        except auth.ExpiredIdTokenError:
            log.error("Token de Firebase expirado")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expirado"
            )
        except Exception as e:
            log.error(f"Error al verificar token: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Error al verificar token"
            )
