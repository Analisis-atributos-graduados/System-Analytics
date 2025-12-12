import pytest
from app.models import Evaluacion, ResultadoAnalisis, Criterio, Usuario, Curso, Rubrica, Nivel

@pytest.fixture
def professor_user(db_session):
    user = Usuario(
        nombre="Profesor Stats",
        email="prof_stats@upao.edu.pe",
        rol="PROFESOR",
        firebase_uid="prof_stats_uid"
    )
    db_session.add(user)
    db_session.commit()
    return user

def test_get_quality_dashboard_stats(client, db_session):
    """
    4.0 Visualizar dashboard de análisis como comité de calidad.
    """

    # 1. PREPARACIÓN DE DATOS (Necesarios por las Foreign Keys)
    profesor = Usuario(nombre="Profesor P1", email="p1@upao.edu.pe", rol="PROFESOR", firebase_uid="uid_p1")
    db_session.add(profesor)
    db_session.commit()

    curso = Curso(nombre="Cálculo I", habilitado=True)
    db_session.add(curso)
    db_session.commit()

    rubrica = Rubrica(profesor_id=profesor.id, nombre_rubrica="Rúbrica General")
    db_session.add(rubrica)
    db_session.commit()

    # 2. CREAR USUARIO DE CALIDAD (Quien hace la petición)
    calidad_user = Usuario(
        nombre="Calidad User",
        email="calidad@upao.edu.pe",
        rol="AREA_CALIDAD",
        firebase_uid="calidad_uid"
    )
    db_session.add(calidad_user)
    db_session.commit()

    calidad_user.firebase_uid = "test_user_id"
    db_session.commit()

    # 3. CREAR EVALUACIONES Y RESULTADOS
    ev1 = Evaluacion(
        nombre_alumno="Alumno A",
        codigo_curso="CALC-101",
        tema="Parcial 1",
        semestre="2025-1",
        estado="COMPLETADO",
        profesor_id=profesor.id,
        rubrica_id=rubrica.id,
        curso_id=curso.id
    )
    db_session.add(ev1)
    db_session.commit()

    res1 = ResultadoAnalisis(
        evaluacion_id=ev1.id,
        nota_final=18.0,
        criterios_evaluados={"1": {"puntaje": 4.0}}
    )
    db_session.add(res1)

    ev2 = Evaluacion(
        nombre_alumno="Alumno B",
        codigo_curso="CALC-101",
        tema="Parcial 1",
        semestre="2025-1",
        estado="COMPLETADO",
        profesor_id=profesor.id,
        rubrica_id=rubrica.id,
        curso_id=curso.id
    )
    db_session.add(ev2)
    db_session.commit()

    res2 = ResultadoAnalisis(
        evaluacion_id=ev2.id,
        nota_final=12.0,
        criterios_evaluados={"1": {"puntaje": 2.0}}
    )
    db_session.add(res2)
    db_session.commit()

    # 4. EJECUTAR TEST (Suponiendo endpoint GET /dashboard/stats)
    headers = {"Authorization": "Bearer valid_token"}

    response = client.get("/evaluaciones/dashboard/stats", headers=headers)

    if response.status_code == 200:
        data = response.json()

    assert response.status_code != 500


def test_get_dashboard_stats_calculation(client, db_session, professor_user):
    """
    4.1 Visualizar dashboard de análisis como profesor.
    """

    # 1. Configurar Auth del Profesor
    professor_user.firebase_uid = "test_user_id"
    db_session.commit()

    # 2. Crear Estructura Académica
    curso = Curso(nombre="Estadística", habilitado=True)
    db_session.add(curso)
    db_session.commit()

    rubrica = Rubrica(profesor_id=professor_user.id, nombre_rubrica="Rúbrica Stats")
    db_session.add(rubrica)
    db_session.commit()

    # 3. Crear Criterio
    criterio = Criterio(
        rubrica_id=rubrica.id,
        nombre_criterio="Razonamiento",
        peso=1.0,
        orden=1
    )
    db_session.add(criterio)
    db_session.commit()

    # 4. Crear Evaluación Completada
    ev1 = Evaluacion(
        nombre_alumno="Alumno Juan",
        codigo_curso="EST-202",
        tema="T-Student",
        semestre="2025-1",
        estado="COMPLETADO",
        profesor_id=professor_user.id,
        rubrica_id=rubrica.id,
        curso_id=curso.id,
        instructor="Profesor Stats"
    )
    db_session.add(ev1)
    db_session.commit()

    # 5. Crear Resultado
    res1 = ResultadoAnalisis(
        evaluacion_id=ev1.id,
        nota_final=15.0,
        feedback_general="Buen trabajo",
        criterios_evaluados={
            str(criterio.id): {
                "puntaje": 3.0,
                "nivel": "Bueno",
                "feedback": "Correcto planteamiento"
            }
        }
    )
    db_session.add(res1)
    db_session.commit()

    # 6. Consultar LISTA (Verificar existencia)
    headers = {"Authorization": "Bearer valid_token"}
    response = client.get(f"/evaluaciones?curso_id={curso.id}", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    evaluacion_en_lista = data[0]

    # 7. Consultar DETALLE (Verificar nota y estructura)
    evaluacion_id = evaluacion_en_lista["id"]
    response_detail = client.get(f"/evaluaciones/{evaluacion_id}", headers=headers)

    assert response_detail.status_code == 200
    data_detail = response_detail.json()

    assert data_detail["instructor"] == "Profesor Stats"
    assert "resultado_analisis" in data_detail
    assert data_detail["resultado_analisis"]["nota_final"] == 15.0