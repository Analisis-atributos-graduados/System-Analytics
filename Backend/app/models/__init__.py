# app/models/__init__.py

# 1. Importar Base y engine para que estén disponibles
from .database import Base, engine, get_db

# 2. Importar TODOS los modelos para que se registren en Base.metadata
from .usuario import Usuario
from .rubrica import Rubrica, Criterio, Nivel
from .evaluacion import Evaluacion
from .archivo_procesado import ArchivoProcesado
from .resultado_analisis import ResultadoAnalisis

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
]
