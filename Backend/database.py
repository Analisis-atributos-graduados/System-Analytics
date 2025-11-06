import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import logging # Importar logging

log = logging.getLogger(__name__) # Obtener logger

DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL is None:
    log.critical("¡ERROR CRÍTICO! No se encontró la variable de entorno DATABASE_URL. La aplicación no puede iniciarse.")
    raise Exception("No se encontró la variable de entorno DATABASE_URL")
else:
    # Opcional: Ocultar la contraseña en los logs si se imprime la URL
    log.info(f"Usando DATABASE_URL: ...@{DATABASE_URL.split('@')[-1]}" if '@' in DATABASE_URL else "Usando DATABASE_URL (formato desconocido o local)")


try:
    # Crear el motor de conexión con pool_pre_ping=True
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True, # ¡ESTA ES LA LÍNEA CLAVE! Verifica la conexión antes de usarla.
        pool_recycle=1800 # Opcional: Recicla conexiones cada 30 min (1800s) para mayor robustez
        # , echo=True # Descomenta esto SOLO para depuración extrema de SQL
    )

    # Crear sesión local
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Base de datos declarativa
    Base = declarative_base()

    log.info("Motor SQLAlchemy y SessionLocal creados exitosamente.")

except Exception as e:
    log.exception("¡ERROR CRÍTICO! Falló la creación del motor SQLAlchemy.")
    # Si el motor no se puede crear, la aplicación no puede funcionar.
    raise Exception(f"Falló la inicialización de la base de datos: {e}")

# Función para obtener la sesión de BD (inyectar dependencia)
def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        log.exception("Error durante la sesión de base de datos.")
        db.rollback() # Asegurar rollback en caso de error
        # Considera relanzar o manejar el error según tu lógica de aplicación
        raise
    finally:
        db.close()
        # log.debug("Sesión de base de datos cerrada.") # Log muy verboso, útil para depurar leaks

