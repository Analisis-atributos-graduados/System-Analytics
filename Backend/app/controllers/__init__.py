from .public_controller import router as public_router
from .auth_controller import router as auth_router
from .rubrica_controller import router as rubrica_router
from .filtros_controller import router as filtros_router
from .evaluacion_controller import router as evaluacion_router
from .worker_controller import router as worker_router

__all__ = [
    'public_router',
    'auth_router',
    'rubrica_router',
    'filtros_router',
    'evaluacion_router',
    'worker_router'
]
