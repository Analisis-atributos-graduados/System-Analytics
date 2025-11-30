from .evaluacion_schemas import (
    ExamBatchRequest,
    PDFFileInfo,
    EvaluacionSchema,
    EvaluacionDetailSchema,
    ResultadoAnalisisSchema,
    ArchivoProcesadoSchema,
    QualityDashboardStats
)
from .task_schemas import FileTaskPayload, EvaluationTaskPayload
from .common_schemas import GenerateUploadURLRequest
from .usuario_schemas import UsuarioCreate, UsuarioResponse, UsuarioCreateByAdmin, UsuarioUpdate
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
    'QualityDashboardStats',

    # Usuarios
    'UsuarioCreate',
    'UsuarioResponse',
    'UsuarioCreateByAdmin',
    'UsuarioUpdate',

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
