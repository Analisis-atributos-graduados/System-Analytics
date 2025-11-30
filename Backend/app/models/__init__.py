# app/models/__init__.py

# 1. Importar Base y engine para que estén disponibles
from app.config.database import Base, engine, get_db

# 2. Importar TODOS los modelos para que se registren en Base.metadata
from .usuario import Usuario
from .rubrica import Rubrica, Criterio, Nivel
from .evaluacion import Evaluacion
from .archivo_procesado import ArchivoProcesado
from .resultado_analisis import ResultadoAnalisis
from .curso import Curso
from .curso_atributo import CursoAtributo
from .meta_porcentaje import MetaPorcentaje

# 3. Definir qué exporta este paquete
__all__ = [
    "Base",
    "engine",
    "get_db",
    "Usuario",
    "Rubrica",
    "Criterio",
    "Nivel",
    "Evaluacion",
    "ArchivoProcesado",
    "ResultadoAnalisis",
    "Curso",
    "CursoAtributo",
    "MetaPorcentaje",
]
