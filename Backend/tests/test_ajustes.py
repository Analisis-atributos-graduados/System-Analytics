import pytest
from unittest.mock import patch, MagicMock
from app.models import Usuario, MetaPorcentaje, Curso
from main import app

@pytest.fixture
def admin_user(db_session):
    user = Usuario(
        nombre="Admin Calidad",
        email="calidad@upao.edu.pe",
        rol="AREA_CALIDAD",
        firebase_uid="admin_uid"
    )
    db_session.add(user)
    db_session.commit()
    return user

def test_update_meta_aprobacion(client, db_session, admin_user):
    # 5.1 Actualizar meta de aprobación
    admin_user.firebase_uid = "test_user_id"
    db_session.commit()
    
    # Crear meta inicial
    meta = MetaPorcentaje(porcentaje=70)
    db_session.add(meta)
    db_session.commit()
    
    payload = {"porcentaje": 85}
    headers = {"Authorization": "Bearer valid_token"}
    
    response = client.put("/meta-porcentaje", json=payload, headers=headers)
    
    assert response.status_code == 200
    assert response.json()["porcentaje"] == 85
    
    db_session.refresh(meta)
    assert meta.porcentaje == 85


def test_register_user(client, db_session, admin_user):
    # 5.2 Registrar usuario
    admin_user.firebase_uid = "test_user_id"
    db_session.commit()

    payload = {
        "email": "newuser@upao.edu.pe",
        "password": "password123",
        "nombre": "New User",
        "rol": "PROFESOR"
    }
    headers = {"Authorization": "Bearer valid_token"}

    with patch("app.controllers.user_controller.auth.create_user") as mock_create:
        mock_create.return_value = MagicMock(uid="new_firebase_uid")

        response = client.post("/users", json=payload, headers=headers)

        # 1. Verificar que la respuesta HTTP sea correcta
        assert response.status_code == 200

        # 2. Verificar los datos que SI devuelve la API (Frontend)
        data = response.json()
        assert data["email"] == "newuser@upao.edu.pe"
        assert data["nombre"] == "New User"
        assert data["rol"] == "PROFESOR"


        # 3. Validar DIRECTAMENTE EN BASE DE DATOS (Backend)
        from app.models import Usuario
        user_db = db_session.query(Usuario).filter_by(email="newuser@upao.edu.pe").first()

        assert user_db is not None
        assert user_db.firebase_uid == "new_firebase_uid"
        assert user_db.nombre == "New User"

def test_delete_user(client, db_session, admin_user):
    # 5.3 Eliminar usuario
    admin_user.firebase_uid = "test_user_id"
    db_session.commit()
    
    user_to_delete = Usuario(
        nombre="User Delete",
        email="delete@upao.edu.pe",
        rol="PROFESOR",
        firebase_uid="delete_uid"
    )
    db_session.add(user_to_delete)
    db_session.commit()
    
    headers = {"Authorization": "Bearer valid_token"}

    with patch("app.controllers.user_controller.auth.delete_user") as mock_delete:
        response = client.delete(f"/users/{user_to_delete.id}", headers=headers)
        
        assert response.status_code == 200
        mock_delete.assert_called_with("delete_uid")

        assert db_session.query(Usuario).filter_by(id=user_to_delete.id).first() is None


def test_assign_attributes(client, db_session, admin_user):
    # 5.4 Asignacion de cursos a atributos
    admin_user.firebase_uid = "test_user_id"
    db_session.commit()
    c1 = Curso(nombre="C1", habilitado=True)
    db_session.add(c1)
    db_session.commit()

    from app.models import MetaPorcentaje
    if not db_session.query(MetaPorcentaje).first():
        db_session.add(MetaPorcentaje(porcentaje=70))
        db_session.commit()

    payload = {
        "meta": 80,
        "asignaciones": [
            {
                "atributo": "AG-07",
                "cursos": [c1.id]
            }
        ]
    }
    headers = {"Authorization": "Bearer valid_token"}

    response = client.post("/cursos/assign-attributes", json=payload, headers=headers)

    assert response.status_code == 200
