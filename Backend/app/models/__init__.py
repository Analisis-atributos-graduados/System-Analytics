from app.config.database import Base, engine, get_db

from .usuario import Usuario
from .rubrica import Rubrica, Criterio, Nivel
from .evaluacion import Evaluacion
from .archivo_procesado import ArchivoProcesado
from .resultado_analisis import ResultadoAnalisis
from .resultado_evaluacion import ResultadoEvaluacion
from .curso import Curso
from .meta_porcentaje import MetaPorcentaje
from .profesor import Profesor
from .nrc import Nrc
from .alumno import Alumno
from .alumno_nrc import AlumnoNrc
from .facultad import Facultad
from .escuela import Escuela

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
    "ResultadoEvaluacion",
    "Curso",
    "MetaPorcentaje",
    "Profesor",
    "Nrc",
    "Alumno",
    "AlumnoNrc",
    "Facultad",
    "Escuela",
]

