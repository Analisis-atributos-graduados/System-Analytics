from .evaluacion_schemas import (
    ExamBatchRequest,
    PDFFileInfo,
    EvaluacionSchema,
    EvaluacionDetailSchema,
    ResultadoAnalisisSchema,
    ArchivoProcesadoSchema
)
from .task_schemas import FileTaskPayload, EvaluationTaskPayload
from .common_schemas import GenerateUploadURLRequest
from .usuario_schemas import UsuarioCreate, UsuarioResponse, UsuarioLogin
from .rubrica_schemas import (
    RubricaCreateRequest,
    RubricaDetailSchema,
    RubricaListSchema,
    CriterioCreateSchema,
    CriterioDetailSchema,
    NivelSchema,
    NivelDetailSchema
)

# ✅ CREAR ALIAS PARA COMPATIBILIDAD CON CONTROLLER
RubricaCreate = RubricaCreateRequest
RubricaResponse = RubricaDetailSchema
RubricaListResponse = RubricaListSchema
CriterioCreate = CriterioCreateSchema
CriterioResponse = CriterioDetailSchema

__all__ = [

    # Evaluaciones
    'ExamBatchRequest',
    'PDFFileInfo',
    'FileTaskPayload',
    'EvaluationTaskPayload',
    'GenerateUploadURLRequest',
    'EvaluacionSchema',
    'EvaluacionDetailSchema',
    'ResultadoAnalisisSchema',
    'ArchivoProcesadoSchema',

    # Usuarios
    'UsuarioCreate',
    'UsuarioResponse',
    'UsuarioLogin',

    # Rúbricas (nombres originales)
    'RubricaCreateRequest',
    'RubricaDetailSchema',
    'RubricaListSchema',
    'CriterioCreateSchema',
    'CriterioDetailSchema',
    'NivelSchema',
    'NivelDetailSchema',

    # Rúbricas (alias para compatibilidad)
    'RubricaCreate',
    'RubricaResponse',
    'RubricaListResponse',
    'CriterioCreate',
    'CriterioResponse'
]
