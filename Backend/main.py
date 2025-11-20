import logging
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Configurar logging ANTES de cualquier import
try:
    from app.config.logging_config import setup_logging

    setup_logging()
except ImportError:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        stream=sys.stdout
    )

log = logging.getLogger(__name__)

log.info("=" * 80)
log.info("🚀 INICIANDO ANALITICA BACKEND v2.1 (Auth + Rúbricas Dinámicas)")
log.info("=" * 80)

# Inicializar Firebase Auth
from app.middleware import FirebaseAuth

try:
    FirebaseAuth.initialize()
    log.info("✅ Firebase Auth inicializado")
except Exception as e:
    log.warning(f"⚠️ Firebase Auth no inicializado: {e}")

# ✅ CORREGIDO: Importar Base, engine Y TODOS los modelos
from app.models import (
    Base,
    engine,
    Usuario,
    Rubrica,
    Criterio,
    Nivel,
    Evaluacion,
    ArchivoProcesado,
    ResultadoAnalisis
)

# Importar routers
from app.controllers import (
    public_router,
    auth_router,
    rubrica_router,
    filtros_router,
    evaluacion_router,
    worker_router
)

# ✅ MEJORADO: Crear tablas con mejor manejo de errores
log.info("Verificando/creando tablas en la base de datos...")
try:
    # Primero, verificar conexión
    with engine.connect() as connection:
        log.info("✅ Conexión a la base de datos establecida")

    # Crear todas las tablas
    Base.metadata.create_all(bind=engine)

    # Listar tablas creadas
    tablas = Base.metadata.tables.keys()
    log.info(f"✅ Tablas verificadas/creadas exitosamente: {list(tablas)}")

except Exception as e:
    log.error(f"❌ Error al crear tablas: {e}")
    import traceback

    log.error(traceback.format_exc())

# Crear aplicación FastAPI
app = FastAPI(
    title="Analitica Backend API",
    description="Sistema de evaluación automatizada con autenticación y rúbricas dinámicas",
    version="2.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar dominios exactos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

log.info("Configurando CORS: allow_origins=['*']")

# Registrar routers
app.include_router(public_router)
app.include_router(auth_router)
app.include_router(rubrica_router)
app.include_router(filtros_router)
app.include_router(evaluacion_router)
app.include_router(worker_router)

log.info("✅ Routers registrados:")
log.info("  - Public: /, /generate-upload-url, /upload-file-proxy")
log.info("  - Auth: /auth/register, /auth/me")
log.info("  - Rúbricas: /rubricas")
log.info("  - Filtros: /filtros/semestres, /filtros/cursos, /filtros/temas")
log.info("  - Evaluaciones: /evaluaciones/*")
log.info("  - Workers: /process-file-task, /process-evaluation-task")


@app.on_event("startup")
async def startup_event():
    """Evento de inicio de la aplicación."""
    log.info("=" * 80)
    log.info("🎉 SERVIDOR INICIADO CORRECTAMENTE")
    log.info("=" * 80)
    log.info("📚 Documentación disponible en: /docs")
    log.info("🔄 Sistema listo para recibir requests")


@app.on_event("shutdown")
async def shutdown_event():
    """Evento de cierre de la aplicación."""
    log.info("=" * 80)
    log.info("🛑 SERVIDOR DETENIDO")
    log.info("=" * 80)


if __name__ == "__main__":
    import uvicorn

    log.info("Iniciando servidor Uvicorn...")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8080,
        log_level="info",
        access_log=True
    )
