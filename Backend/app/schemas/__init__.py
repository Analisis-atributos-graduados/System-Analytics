from .evaluacion_schemas import (
    ExamBatchRequest,
    PDFFileInfo,
    EvaluacionSchema,
    EvaluacionDetailSchema,
    ResultadoAnalisisSchema,
    ArchivoProcesadoSchema,
    QualityDashboardStats,
    EvaluacionFeedbackProfesorUpdateSchema
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
    NivelDetailSchema,
    RubricaRevisionSchema
)

RubricaCreate = RubricaCreateRequest
RubricaResponse = RubricaDetailSchema
RubricaListResponse = RubricaListSchema
CriterioCreate = CriterioCreateSchema
CriterioResponse = CriterioDetailSchema

__all__ = [

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
    'EvaluacionFeedbackProfesorUpdateSchema',

    'UsuarioCreate',
    'UsuarioResponse',
    'UsuarioCreateByAdmin',
    'UsuarioUpdate',

    'RubricaCreateRequest',
    'RubricaDetailSchema',
    'RubricaListSchema',
    'CriterioCreateSchema',
    'CriterioDetailSchema',
    'NivelSchema',
    'NivelDetailSchema',

    'RubricaCreate',
    'RubricaResponse',
    'RubricaListResponse',
    'CriterioCreate',
    'CriterioResponse',
    'RubricaRevisionSchema'
]
