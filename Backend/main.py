from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()

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

FirebaseAuth.initialize()

Base.metadata.create_all(bind=engine)

try:
    from sqlalchemy import text
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE resultados_analisis ADD COLUMN IF NOT EXISTS resultado_evaluacion_id INTEGER REFERENCES resultados_evaluacion(id) ON DELETE SET NULL;"))
    print("Base de datos: Columna resultado_evaluacion_id verificada/creada.")
except Exception as db_err:
    print(f"Error al verificar/crear columna en la base de datos: {db_err}")

app = FastAPI(title="Analítica Académica API", version="1.0.0")

from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

@app.middleware("http")
async def proxy_headers_middleware(request, call_next):

    if "x-forwarded-proto" in request.headers:
        request.scope["scheme"] = request.headers["x-forwarded-proto"]
    response = await call_next(request)
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    return {"message": "API de Analítica Académica funcionando"}
