import logging
from fastapi import HTTPException, status
import firebase_admin
from firebase_admin import credentials, auth
import os

log = logging.getLogger(__name__)


class FirebaseAuth:

    _initialized = False

    @classmethod
    def initialize(cls):
        if cls._initialized:
            return

        try:
            cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "credentials.json")
            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
                log.info("Firebase inicializado con archivo de credenciales")
            else:
                firebase_admin.initialize_app()
                log.info("Firebase inicializado con credenciales por defecto")

            cls._initialized = True
        except Exception as e:
            log.critical(f"Error CRÍTICO al inicializar Firebase: {e}")
            raise RuntimeError(f"Fallo al inicializar Firebase Admin SDK: {e}")

    @staticmethod
    def verify_token(token: str) -> dict:

        try:
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
