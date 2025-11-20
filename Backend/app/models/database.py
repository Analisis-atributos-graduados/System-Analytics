from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
import logging
import os

log = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL")

# ✅ CONFIGURACIÓN MEJORADA para procesos largos
engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,  # No usar pool para evitar conexiones muertas
    pool_pre_ping=True,  # Verificar conexión antes de usar
    pool_recycle=3600,  # Reciclar conexiones cada hora
    connect_args={
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    }
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """
    Dependency que proporciona sesiones de base de datos con manejo de errores.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        log.error(f"Error durante la sesión de base de datos.")
        log.error(f"500: {e}")
        db.rollback()
        raise
    finally:
        db.close()
