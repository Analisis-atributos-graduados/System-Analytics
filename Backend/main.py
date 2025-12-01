from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.config.database import engine, Base
from app.controllers import (
    auth_controller,
    public_controller,
    evaluacion_controller, 
    filtros_controller,
    rubrica_controller,
    curso_controller,
    meta_porcentaje_controller,
    worker_controller,
    user_controller
)
from app.models import Curso, MetaPorcentaje
from app.middleware import FirebaseAuth

# Inicializar Firebase
FirebaseAuth.initialize()

# Crear tablas si no existen
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Analítica Académica API", version="1.0.0")

# IMPORTANTE: Middleware para confiar en headers del proxy (Cloud Run)
# Esto asegura que los redirects usen HTTPS en lugar de HTTP
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

# Agregar middleware para manejar correctamente HTTPS detrás de proxy
@app.middleware("http")
async def proxy_headers_middleware(request, call_next):
    # Cloud Run envía el esquema original en X-Forwarded-Proto
    if "x-forwarded-proto" in request.headers:
        request.scope["scheme"] = request.headers["x-forwarded-proto"]
    response = await call_next(request)
    return response


# Configuración CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar Routers
app.include_router(public_controller.router)
app.include_router(auth_controller.router)
app.include_router(user_controller.router)
app.include_router(evaluacion_controller.router)
app.include_router(filtros_controller.router)
app.include_router(rubrica_controller.router)
app.include_router(curso_controller.router)
app.include_router(meta_porcentaje_controller.router)
app.include_router(worker_controller.router)

@app.get("/")
def read_root():
    return {"message": "API de Analítica Académica funcionando 🚀"}
