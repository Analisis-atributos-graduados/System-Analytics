from functools import lru_cache
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, Header, status

from app.models import get_db, Usuario
from app.repositories import (
    UsuarioRepository,
    RubricaRepository,
    EvaluacionRepository,
    ArchivoRepository,
    ResultadoRepository
)
from app.middleware import FirebaseAuth

from app.clients import GCSClient, TaskClient, GeminiClient, RapidAPIClient
from app.extractors import TextExtractor, ImageExtractor, StudentNameMatcher
from app.services.gemini_analyzer import GeminiAnalyzer
from app.services import (
    OrchestratorService,
    ExtractionService,
    AnalysisService,
    ScoringService,
    TaskService
)

# Clients (singleton)
@lru_cache()
def get_gcs_client() -> GCSClient:
    return GCSClient()

@lru_cache()
def get_task_client() -> TaskClient:
    return TaskClient()

@lru_cache()
def get_gemini_client() -> GeminiClient:
    return GeminiClient()

@lru_cache()
def get_rapidapi_client() -> RapidAPIClient:
    return RapidAPIClient()

# Extractors (singleton)
@lru_cache()
def get_text_extractor() -> TextExtractor:
    return TextExtractor()

@lru_cache()
def get_image_extractor() -> ImageExtractor:
    return ImageExtractor()

@lru_cache()
def get_student_matcher() -> StudentNameMatcher:
    return StudentNameMatcher()

# Analyzers (singleton)
@lru_cache()
def get_gemini_analyzer() -> GeminiAnalyzer:
    return GeminiAnalyzer()

# Services
def get_task_service(
    task_client: TaskClient = Depends(get_task_client)
) -> TaskService:
    return TaskService(task_client)

def get_extraction_service(
    db: Session = Depends(get_db),
    gcs_client: GCSClient = Depends(get_gcs_client),
    ocr_client: RapidAPIClient = Depends(get_rapidapi_client),
    gemini_client: GeminiClient = Depends(get_gemini_client),
    text_extractor: TextExtractor = Depends(get_text_extractor),
    image_extractor: ImageExtractor = Depends(get_image_extractor),
    student_matcher: StudentNameMatcher = Depends(get_student_matcher)
) -> ExtractionService:
    archivo_repo = ArchivoRepository(db)
    return ExtractionService(
        gcs_client=gcs_client,
        ocr_client=ocr_client,
        gemini_client=gemini_client,
        text_extractor=text_extractor,
        image_extractor=image_extractor,
        student_matcher=student_matcher,
        archivo_repo=archivo_repo
    )

def get_analysis_service(
    db: Session = Depends(get_db),
    gemini_analyzer: GeminiAnalyzer = Depends(get_gemini_analyzer)
) -> AnalysisService:
    archivo_repo = ArchivoRepository(db)
    resultado_repo = ResultadoRepository(db)
    rubrica_repo = RubricaRepository(db)
    evaluacion_repo = EvaluacionRepository(db)

    return AnalysisService(
        evaluacion_repo=evaluacion_repo,
        archivo_repo=archivo_repo,
        rubrica_repo=rubrica_repo,
        resultado_repo=resultado_repo,
        gemini_analyzer=gemini_analyzer
    )

def get_orchestrator_service(
    db: Session = Depends(get_db),
    gcs_client: GCSClient = Depends(get_gcs_client),
    task_service: TaskService = Depends(get_task_service),
    ocr_client: RapidAPIClient = Depends(get_rapidapi_client),
    student_matcher: StudentNameMatcher = Depends(get_student_matcher)
) -> OrchestratorService:
    evaluacion_repo = EvaluacionRepository(db)
    rubrica_repo = RubricaRepository(db)
    return OrchestratorService(
        evaluacion_repo=evaluacion_repo,
        rubrica_repo=rubrica_repo,
        gcs_client=gcs_client,
        task_service=task_service,
        ocr_client=ocr_client,
        student_matcher=student_matcher
    )


# ============= AUTENTICACIÓN =============

async def get_token_from_header(authorization: Optional[str] = Header(None)) -> str:
    """Extrae el token del header Authorization."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se proporcionó token de autenticación"
        )

    # Espera formato: "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Formato de token inválido"
        )

    return parts[1]


async def get_current_user(
        token: str = Depends(get_token_from_header),
        db: Session = Depends(get_db)
) -> Usuario:
    """
    Dependency que valida el token de Firebase y devuelve el usuario actual.
    """
    # Verificar token con Firebase
    firebase_user = FirebaseAuth.verify_token(token)

    # Buscar usuario en BD
    usuario_repo = UsuarioRepository(db)
    usuario = usuario_repo.get_by_firebase_uid(firebase_user["uid"])

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado en el sistema"
        )

    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo"
        )

    return usuario


def require_role(*allowed_roles):
    """
    Dependency para requerir roles específicos.
    """

    async def role_checker(
            current_user: Usuario = Depends(get_current_user)
    ):
        if current_user.rol not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"No tienes permisos. Se requiere rol: {', '.join(allowed_roles)}"
            )
        return current_user

    return role_checker


# ============= REPOSITORIES =============

def get_usuario_repository(db: Session = Depends(get_db)) -> UsuarioRepository:
    return UsuarioRepository(db)


def get_rubrica_repository(db: Session = Depends(get_db)) -> RubricaRepository:
    return RubricaRepository(db)