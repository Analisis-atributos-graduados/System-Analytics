import logging
import os
from typing import List, Dict
from PyPDF2 import PdfReader, PdfWriter
import io

from app.repositories import EvaluacionRepository, RubricaRepository
from app.clients import GCSClient, TaskClient
from .task_service import TaskService
from app.models import Evaluacion

log = logging.getLogger(__name__)


class OrchestratorService:
    """Orquesta el procesamiento completo de lotes de documentos."""

    def __init__(
            self,
            evaluacion_repo: EvaluacionRepository,
            rubrica_repo: RubricaRepository,
            gcs_client: GCSClient,
            task_service: TaskService
    ):
        self.evaluacion_repo = evaluacion_repo
        self.rubrica_repo = rubrica_repo
        self.gcs_client = gcs_client
        self.task_service = task_service

    def process_exam_batch(
            self,
            profesor_id: int,
            rubrica_id: int,
            pdf_files: List[Dict],
            student_list: str,
            nombre_curso: str,
            codigo_curso: str,
            instructor: str,
            semestre: str,
            tema: str,
            descripcion_tema: str,
            tipo_documento: str
    ) -> Dict:
        """
        Procesa un lote de exámenes o ensayos.
        Valida que la rúbrica exista y pertenezca al profesor.
        """
        try:
            log.info(f"Iniciando procesamiento: profesor_id={profesor_id}, rubrica_id={rubrica_id}")

            # Validar rúbrica
            rubrica = self.rubrica_repo.get_by_id(rubrica_id)
            if not rubrica:
                raise ValueError(f"Rúbrica {rubrica_id} no encontrada")

            if rubrica.profesor_id != profesor_id:
                raise ValueError(f"La rúbrica {rubrica_id} no pertenece al profesor {profesor_id}")

            if not rubrica.activo:
                raise ValueError(f"La rúbrica {rubrica_id} está inactiva")

            log.info(f"Rúbrica validada: {rubrica.nombre_rubrica}")

            # Parsear lista de estudiantes
            students = [s.strip() for s in student_list.strip().split('\n') if s.strip()]
            log.info(f"Estudiantes en la lista: {len(students)}")

            # Decidir estrategia según tipo de documento
            if tipo_documento == "examen":
                return self._process_handwritten_exams(
                    profesor_id=profesor_id,
                    rubrica_id=rubrica_id,
                    pdf_files=pdf_files,
                    students=students,
                    nombre_curso=nombre_curso,
                    codigo_curso=codigo_curso,
                    instructor=instructor,
                    semestre=semestre,
                    tema=tema,
                    descripcion_tema=descripcion_tema
                )
            else:  # ensayo/informe
                return self._process_essays(
                    profesor_id=profesor_id,
                    rubrica_id=rubrica_id,
                    pdf_files=pdf_files,
                    students=students,
                    nombre_curso=nombre_curso,
                    codigo_curso=codigo_curso,
                    instructor=instructor,
                    semestre=semestre,
                    tema=tema,
                    descripcion_tema=descripcion_tema,
                    tipo_documento=tipo_documento
                )

        except Exception as e:
            log.error(f"Error en process_exam_batch: {e}")
            raise

    def _process_handwritten_exams(
            self,
            profesor_id: int,
            rubrica_id: int,
            pdf_files: List[Dict],
            students: List[str],
            nombre_curso: str,
            codigo_curso: str,
            instructor: str,
            semestre: str,
            tema: str,
            descripcion_tema: str
    ) -> Dict:
        """Procesa exámenes manuscritos (cara impar + cara par → examen completo)."""
        try:
            log.info("Procesando exámenes manuscritos...")

            # Separar caras impares y pares
            caras_impares = []
            caras_pares = []

            for pdf_info in pdf_files:
                filename = pdf_info['original_filename'].lower()
                if 'impar' in filename or 'odd' in filename:
                    caras_impares.append(pdf_info)
                elif 'par' in filename or 'even' in filename:
                    caras_pares.append(pdf_info)
                else:
                    log.warning(f"Archivo no clasificado: {filename}")

            if not caras_impares or not caras_pares:
                raise ValueError("Se requieren archivos de caras impares y pares")

            log.info(f"Caras impares: {len(caras_impares)}, Caras pares: {len(caras_pares)}")

            # Descargar PDFs de GCS
            impares_bytes = self.gcs_client.download_blob(caras_impares[0]['gcs_filename'])
            pares_bytes = self.gcs_client.download_blob(caras_pares[0]['gcs_filename'])

            # Leer PDFs
            pdf_impares = PdfReader(io.BytesIO(impares_bytes))
            pdf_pares = PdfReader(io.BytesIO(pares_bytes))

            num_students = min(len(students), len(pdf_impares.pages))
            log.info(f"Procesando {num_students} exámenes")

            evaluaciones_creadas = []

            # Crear un examen completo por estudiante
            for i in range(num_students):
                nombre_alumno = students[i]

                # ✅ CORREGIDO: Crear instancia del modelo
                evaluacion = Evaluacion(
                    profesor_id=profesor_id,
                    rubrica_id=rubrica_id,
                    nombre_alumno=nombre_alumno,  # ✅ CORREGIDO
                    nombre_curso=nombre_curso,
                    codigo_curso=codigo_curso,
                    instructor=instructor,
                    semestre=semestre,
                    tema=tema,
                    descripcion_tema=descripcion_tema,
                    tipo_documento="examen",  # ✅ AGREGADO
                    estado="pendiente"
                )

                # Guardar en base de datos
                evaluacion = self.evaluacion_repo.create(evaluacion)

                log.info(f"Evaluación creada: ID={evaluacion.id}, Alumno={nombre_alumno}")

                # Combinar páginas impar y par
                writer = PdfWriter()
                writer.add_page(pdf_impares.pages[i])

                if i < len(pdf_pares.pages):
                    writer.add_page(pdf_pares.pages[i])

                # Guardar PDF combinado
                combined_buffer = io.BytesIO()
                writer.write(combined_buffer)
                combined_bytes = combined_buffer.getvalue()

                # Subir a GCS
                combined_filename = f"examen_{evaluacion.id}_{nombre_alumno.replace(' ', '_')}.pdf"
                self.gcs_client.upload_blob(combined_bytes, combined_filename, "application/pdf")

                log.info(f"PDF combinado subido: {combined_filename}")

                # Crear tarea para procesar este examen
                self.task_service.create_file_task(
                    gcs_filename=combined_filename,
                    original_filename=combined_filename,
                    evaluacion_id=evaluacion.id,
                    tipo_documento="examen"
                )

                evaluaciones_creadas.append({
                    'evaluacion_id': evaluacion.id,
                    'nombre_alumno': nombre_alumno,
                    'archivo': combined_filename
                })

            log.info(f"✅ Lote procesado: {len(evaluaciones_creadas)} exámenes encolados")

            return {
                'success': True,
                'tipo': 'examen',
                'evaluaciones_creadas': evaluaciones_creadas,
                'total': len(evaluaciones_creadas)
            }

        except Exception as e:
            log.error(f"Error en _process_handwritten_exams: {e}")
            raise

    def _process_essays(
            self,
            profesor_id: int,
            rubrica_id: int,
            pdf_files: List[Dict],
            students: List[str],
            nombre_curso: str,
            codigo_curso: str,
            instructor: str,
            semestre: str,
            tema: str,
            descripcion_tema: str,
            tipo_documento: str
    ) -> Dict:
        """Procesa ensayos/informes (1 archivo = 1 estudiante)."""
        try:
            log.info("Procesando ensayos/informes...")

            evaluaciones_creadas = []

            for pdf_info in pdf_files:
                gcs_filename = pdf_info['gcs_filename']
                original_filename = pdf_info['original_filename']

                # Intentar extraer nombre del estudiante del filename
                nombre_extraido = original_filename.replace('_', ' ').replace('-', ' ').rsplit('.', 1)[0]
                nombre_alumno = nombre_extraido if not students else students[0] if students else "Por identificar"

                # ✅ CORREGIDO: Crear instancia del modelo
                evaluacion = Evaluacion(
                    profesor_id=profesor_id,
                    rubrica_id=rubrica_id,
                    nombre_alumno=nombre_alumno,
                    nombre_curso=nombre_curso,
                    codigo_curso=codigo_curso,
                    instructor=instructor,
                    semestre=semestre,
                    tema=tema,
                    descripcion_tema=descripcion_tema,
                    tipo_documento=tipo_documento,
                    estado="pendiente"
                )

                # Guardar en base de datos
                evaluacion = self.evaluacion_repo.create(evaluacion)

                log.info(f"Evaluación creada: ID={evaluacion.id}, Archivo={original_filename}")

                # Crear tarea para procesar este archivo
                self.task_service.create_file_task(
                    gcs_filename=gcs_filename,
                    original_filename=original_filename,
                    evaluacion_id=evaluacion.id,
                    tipo_documento=tipo_documento
                )

                evaluaciones_creadas.append({
                    'evaluacion_id': evaluacion.id,
                    'nombre_alumno': nombre_alumno,
                    'archivo': original_filename
                })

            log.info(f"✅ Lote procesado: {len(evaluaciones_creadas)} ensayos encolados")

            return {
                'success': True,
                'tipo': tipo_documento,
                'evaluaciones_creadas': evaluaciones_creadas,
                'total': len(evaluaciones_creadas)
            }

        except Exception as e:
            log.error(f"Error en _process_essays: {e}")
            raise
