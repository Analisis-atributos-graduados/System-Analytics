import pytest
from app.models import Usuario


def test_login_success(client, db_session):
    # 1.0 Iniciar Sesion / Ver perfil

    user = Usuario(
        nombre="Test User",
        email="test@upao.edu.pe",
        rol="PROFESOR",
        firebase_uid="test_user_id"
    )
    db_session.add(user)
    db_session.commit()

    headers = {"Authorization": "Bearer valid_token"}
    response = client.get("/auth/me", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@upao.edu.pe"
    assert data["rol"] == "PROFESOR"


def test_register_user_flow(client, db_session):
    # Prueba el flujo de registro de un usuario pre-autorizado

    # 1. Admin crea usuario pendiente (simulado)
    pending_user = Usuario(
        nombre="Pending User",
        email="new@upao.edu.pe",
        rol="PROFESOR",
        firebase_uid="pending:new@upao.edu.pe"
    )
    db_session.add(pending_user)
    db_session.commit()

    # 2. Usuario hace login en Firebase y obtiene UID real
    real_firebase_uid = "real_uid_123"

    payload = {
        "email": "new@upao.edu.pe",
        "nombre": "Pending User",
        "rol": "PROFESOR",
        "firebase_uid": real_firebase_uid
    }

    headers = {"Authorization": "Bearer valid_token"}

    response = client.post("/auth/register", json=payload, headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == pending_user.id

    updated_user = db_session.query(Usuario).filter_by(id=pending_user.id).first()
    assert updated_user.firebase_uid == real_firebase_uid

def test_login_google_simulation(client, db_session):
    """
    1.1 Iniciar Sesion con Google.
    """
    # 1. Crear un usuario que ya existe en tu BD (simula que ya se registró antes)
    user = Usuario(
        nombre="Usuario Google",
        email="google@upao.edu.pe",
        rol="PROFESOR",
        firebase_uid="uid_google_123"
    )
    db_session.add(user)
    db_session.commit()

    # 2. Simular Token de Firebase
    user.firebase_uid = "test_user_id"
    db_session.commit()

    headers = {"Authorization": "Bearer valid_token"}

    # 3. Llamar al endpoint /me. Si responde 200 y los datos, el login fue exitoso.
    response = client.get("/auth/me", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "google@upao.edu.pe"
    assert data["nombre"] == "Usuario Google"