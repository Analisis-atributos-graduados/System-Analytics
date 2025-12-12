from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
import logging
import os

log = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://user:pass@localhost/db")

connect_args = {}

if "sqlite" in DATABASE_URL:

    connect_args = {"check_same_thread": False}
else:

    connect_args = {
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    }

engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():

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