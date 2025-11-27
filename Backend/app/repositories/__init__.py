from .base_repository import BaseRepository
from .usuario_repository import UsuarioRepository
from .rubrica_repository import RubricaRepository
from .evaluacion_repository import EvaluacionRepository
from .archivo_repository import ArchivoRepository
from .resultado_repository import ResultadoRepository
from .curso_repository import CursoRepository
from .meta_porcentaje_repository import MetaPorcentajeRepository

__all__ = [
    'BaseRepository',
    'UsuarioRepository',
    'RubricaRepository',
    'EvaluacionRepository',
    'ArchivoRepository',
    'ResultadoRepository',
    'CursoRepository',
    'MetaPorcentajeRepository'
]
