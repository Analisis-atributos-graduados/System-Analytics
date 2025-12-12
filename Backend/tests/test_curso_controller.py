import pytest
from app.models import Curso, Usuario


@pytest.fixture
def admin_user(db_session):
    user = Usuario(
        nombre="Admin Calidad",
        email="calidad@upao.edu.pe",
        rol="AREA_CALIDAD",
        firebase_uid="test_user_id"
    )
    db_session.add(user)
    db_session.commit()
    return user


def test_create_curso_success(client, admin_user):
    # 2.0 Registro del Curso

    payload = {
        "nombre": "Nuevo Curso",
        "habilitado": True
    }
    headers = {"Authorization": "Bearer valid_token"}

    response = client.post("/cursos", json=payload, headers=headers)

    assert response.status_code == 201
    data = response.json()
    assert data["nombre"] == "Nuevo Curso"