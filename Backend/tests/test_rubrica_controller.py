import pytest
from app.models import Rubrica, Criterio, Usuario


@pytest.fixture
def professor_user(db_session):
    user = Usuario(
        nombre="Profesor Rubrica",
        email="prof_rubrica@upao.edu.pe",
        rol="PROFESOR",
        firebase_uid="prof_rubrica_uid"
    )
    db_session.add(user)
    db_session.commit()
    return user


def test_create_rubrica_success(client, db_session, professor_user):
    # 2.2 Configuración de rúbrica

    professor_user.firebase_uid = "test_user_id"
    db_session.commit()

    payload = {
        "nombre_rubrica": "Rúbrica Test",
        "descripcion": "Descripción de la rúbrica",
        "criterios": [
            {
                "nombre_criterio": "Criterio 1",
                "peso": 0.5,
                "descripcion_criterio": "Evaluación de sintaxis",
                "niveles": [
                    {
                        "nombre_nivel": "Excelente",
                        "puntaje_min": 3.0,
                        "puntaje_max": 4.0,
                        "descriptores": ["Sin errores"],
                        "orden": 1
                    },
                    {
                        "nombre_nivel": "Regular",
                        "puntaje_min": 0.0,
                        "puntaje_max": 2.9,
                        "descriptores": ["Con errores"],
                        "orden": 2
                    }
                ]
            },
            {
                "nombre_criterio": "Criterio 2",
                "peso": 0.5,
                "descripcion_criterio": "Evaluación de lógica",
                "niveles": [
                    {
                        "nombre_nivel": "Logrado",
                        "puntaje_min": 3.0,
                        "puntaje_max": 4.0,
                        "descriptores": ["Lógica correcta"],
                        "orden": 1
                    }
                ]
            }
        ]
    }
    headers = {"Authorization": "Bearer valid_token"}

    response = client.post("/rubricas", json=payload, headers=headers)

    if response.status_code != 200:
        print("\nERROR BACKEND:", response.json())

    assert response.status_code == 200
    data = response.json()
    assert data["nombre_rubrica"] == "Rúbrica Test"

    assert len(data["criterios"]) == 2
    assert len(data["criterios"][0]["niveles"]) >= 1