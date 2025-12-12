import pytest
from unittest.mock import MagicMock
from app.models import Usuario, Curso, Rubrica
from app.services.orchestrator_service import OrchestratorService
from app.config.dependencies import get_orchestrator_service
from main import app

@pytest.fixture
def professor_user(db_session):
    user = Usuario(
        nombre="Profesor Docs",
        email="prof_docs@upao.edu.pe",
        rol="PROFESOR",
        firebase_uid="prof_docs_uid"
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def curso_test(db_session):

    curso = Curso(nombre="Curso Docs", habilitado=True)
    db_session.add(curso)
    db_session.commit()
    return curso


@pytest.fixture
def rubrica_test(db_session, professor_user):

    rubrica = Rubrica(
        profesor_id=professor_user.id,
        nombre_rubrica="Rubrica General"
    )
    db_session.add(rubrica)
    db_session.commit()
    return rubrica


def test_upload_manuscritos(client, db_session, professor_user, curso_test, rubrica_test):
    # 3.0 Subir exámenes manuscritos

    mock_orchestrator = MagicMock(spec=OrchestratorService)
    mock_orchestrator.process_exam_batch.return_value = {"message": "Batch processed", "batch_id": "123"}
    app.dependency_overrides[get_orchestrator_service] = lambda: mock_orchestrator

    professor_user.firebase_uid = "test_user_id"
    db_session.commit()

    payload = {
        "pdf_files": [{"gcs_filename": "file1.pdf", "original_filename": "examen.pdf"}],
        "student_list": "Alumno 1\nAlumno 2",
        "rubrica_id": rubrica_test.id,
        "curso_id": curso_test.id,
        "codigo_curso": "MAT101",
        "instructor": "Profesor Docs",
        "semestre": "2025-1",
        "tema": "Parcial 1",
        "tipo_documento": "examen"
    }
    headers = {"Authorization": "Bearer valid_token"}

    response = client.post("/evaluaciones/enqueue-exam-batch", json=payload, headers=headers)

    if response.status_code != 200:
        print("\nERROR DETALLADO:", response.json())

    assert response.status_code == 200

    kwargs = mock_orchestrator.process_exam_batch.call_args.kwargs
    assert kwargs["tipo_documento"] == "examen"
    assert kwargs["curso_id"] == curso_test.id

    app.dependency_overrides.pop(get_orchestrator_service)

def test_upload_ensayos_informes(client, db_session, professor_user, curso_test, rubrica_test):
    """
    3.1 Subir ensayos / informes.
    """

    from app.services.orchestrator_service import OrchestratorService
    from app.config.dependencies import get_orchestrator_service
    from unittest.mock import MagicMock

    mock_orchestrator = MagicMock(spec=OrchestratorService)
    mock_orchestrator.process_exam_batch.return_value = {"message": "Batch processed", "batch_id": "999"}
    app.dependency_overrides[get_orchestrator_service] = lambda: mock_orchestrator

    professor_user.firebase_uid = "test_user_id"
    db_session.commit()

    payload = {
        "pdf_files": [{"gcs_filename": "essay.pdf", "original_filename": "informe_final.pdf"}],
        "student_list": "Alumno Ensayo",
        "rubrica_id": rubrica_test.id,
        "curso_id": curso_test.id,
        "codigo_curso": "LIT-101",
        "instructor": "Profesor Literatura",
        "semestre": "2025-1",
        "tema": "El Quijote",
        "tipo_documento": "ensayo/informe"
    }
    headers = {"Authorization": "Bearer valid_token"}

    response = client.post("/evaluaciones/enqueue-exam-batch", json=payload, headers=headers)

    assert response.status_code == 200

    kwargs = mock_orchestrator.process_exam_batch.call_args.kwargs
    assert kwargs["tipo_documento"] == "ensayo/informe"

    app.dependency_overrides.pop(get_orchestrator_service)

def test_registro_topico_tema(client, db_session, professor_user, curso_test, rubrica_test):
    """
    2.1 Registro del Tópico / Tema.
    """

    mock_orchestrator = MagicMock(spec=OrchestratorService)
    mock_orchestrator.process_exam_batch.return_value = {"message": "Ok", "batch_id": "1"}

    app.dependency_overrides[get_orchestrator_service] = lambda: mock_orchestrator

    professor_user.firebase_uid = "test_user_id"
    db_session.commit()

    tema_especifico = "Derivadas Parciales 2025"

    payload = {
        "pdf_files": [{"gcs_filename": "f.pdf", "original_filename": "o.pdf"}],
        "student_list": "A1",
        "rubrica_id": rubrica_test.id,
        "curso_id": curso_test.id,
        "codigo_curso": "MAT",
        "instructor": "Prof",
        "semestre": "2025-1",
        "tema": tema_especifico,
        "tipo_documento": "examen"
    }
    headers = {"Authorization": "Bearer valid_token"}

    client.post("/evaluaciones/enqueue-exam-batch", json=payload, headers=headers)

    kwargs = mock_orchestrator.process_exam_batch.call_args.kwargs
    assert kwargs["tema"] == tema_especifico

    app.dependency_overrides.pop(get_orchestrator_service)