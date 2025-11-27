import logging
import os
from typing import List, Dict
from PyPDF2 import PdfReader, PdfWriter
import io
import fitz  # PyMuPDF

from app.repositories import EvaluacionRepository, RubricaRepository, CursoRepository
from app.clients import GCSClient, TaskClient, RapidAPIClient
from app.extractors import StudentNameMatcher
from .task_service import TaskService
from app.models import Evaluacion

log = logging.getLogger(__name__)


class OrchestratorService:
    """Orquesta el procesamiento completo de lotes de documentos."""

    def __init__(
            self,
            evaluacion_repo: EvaluacionRepository,
            rubrica_repo: RubricaRepository,
            curso_repo: CursoRepository,  # ✅ Inyectar CursoRepository
            gcs_client: GCSClient,
            task_service: TaskService,
            ocr_client: RapidAPIClient,
            student_matcher: StudentNameMatcher
    ):
        self.evaluacion_repo = evaluacion_repo
        self.rubrica_repo = rubrica_repo
        self.curso_repo = curso_repo  # ✅ Guardar repo
        self.gcs_client = gcs_client
        self.task_service = task_service
        self.ocr_client = ocr_client
        self.student_matcher = student_matcher

    def process_exam_batch(
            self,
            profesor_id: int,
            rubrica_id: int,
            pdf_files: List[Dict],
            student_list: str,
            curso_id: int,  # ✅ CAMBIO: curso_id en lugar de nombre_curso
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
            log.info(f"Iniciando procesamiento: profesor_id={profesor_id}, rubrica_id={rubrica_id}, curso_id={curso_id}")

            # Validar rúbrica
            rubrica = self.rubrica_repo.get_by_id(rubrica_id)
            if not rubrica:
                raise ValueError(f"Rúbrica {rubrica_id} no encontrada")

            if rubrica.profesor_id != profesor_id:
                raise ValueError(f"La rúbrica {rubrica_id} no pertenece al profesor {profesor_id}")

            if not rubrica.activo:
                raise ValueError(f"La rúbrica {rubrica_id} está inactiva")

            # ✅ Validar curso
            curso = self.curso_repo.get_by_id(curso_id)
            if not curso:
                raise ValueError(f"Curso {curso_id} no encontrado")

            log.info(f"Rúbrica validada: {rubrica.nombre_rubrica}")
            log.info(f"Curso validado: {curso.nombre}")

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
                    curso_id=curso_id,  # ✅ Pasar ID
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
                    curso_id=curso_id,  # ✅ Pasar ID
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
            curso_id: int,  # ✅ Recibir ID
            codigo_curso: str,
            instructor: str,
            semestre: str,
            tema: str,
            descripcion_tema: str
    ) -> Dict:
        """
        Procesa exámenes manuscritos con lógica compleja de caras intercaladas.
        """
        try:
            log.info("Procesando exámenes manuscritos (Lógica Multi-Cara)...")

            # ... (código de ordenamiento de archivos igual) ...
            import re
            
            def get_face_number(filename):
                match = re.search(r'cara_(\d+)', filename.lower())
                return int(match.group(1)) if match else 999

            sorted_files = sorted(pdf_files, key=lambda x: get_face_number(x['original_filename']))
            
            if not sorted_files:
                raise ValueError("No se recibieron archivos válidos (deben llamarse 'cara_X.pdf')")

            # ... (código de descarga de PDFs igual) ...
            face_pdfs = [] 
            face_images = [] 
            
            for f in sorted_files:
                pdf_bytes = self.gcs_client.download_blob(f['gcs_filename'])
                face_pdfs.append(PdfReader(io.BytesIO(pdf_bytes)))
                face_images.append(fitz.open(stream=pdf_bytes, filetype="pdf"))

            if get_face_number(sorted_files[0]['original_filename']) != 1:
                raise ValueError("Falta el archivo de la primera cara (cara_1.pdf)")

            num_students_in_batch = len(face_pdfs[0].pages)
            log.info(f"Detectados {num_students_in_batch} exámenes en el lote (basado en cara_1)")

            evaluaciones_creadas = []

            for i in range(num_students_in_batch):
                # ... (código de OCR igual) ...
                page_img = face_images[0].load_page(i)
                pix = page_img.get_pixmap()
                img_bytes = pix.tobytes("png")
                
                texto_ocr = self.ocr_client.ocr_image(img_bytes)
                
                nombre_alumno = "UNKNOWN"
                if texto_ocr:
                    match_result = self.student_matcher.find_student_name(texto_ocr, students)
                    if match_result:
                        nombre_alumno = match_result[0]
                
                if nombre_alumno == "UNKNOWN":
                    nombre_alumno = f"Estudiante_Desconocido_{i+1}"
                    log.warning(f"No se pudo identificar alumno en índice {i}. Asignando: {nombre_alumno}")
                else:
                    log.info(f"Alumno identificado en índice {i}: {nombre_alumno}")

                # 4. Crear registro de Evaluación
                evaluacion = Evaluacion(
                    profesor_id=profesor_id,
                    rubrica_id=rubrica_id,
                    nombre_alumno=nombre_alumno,
                    curso_id=curso_id,  # ✅ Usar ID
                    codigo_curso=codigo_curso,
                    instructor=instructor,
                    semestre=semestre,
                    tema=tema,
                    descripcion_tema=descripcion_tema,
                    tipo_documento="examen",
                    estado="pendiente"
                )
                evaluacion = self.evaluacion_repo.create(evaluacion)

                # ... (resto de lógica igual) ...
                # 5. Reconstruir PDF del estudiante (Sandwich Logic)
                writer = PdfWriter()
                
                for face_idx, pdf_reader in enumerate(face_pdfs):
                    face_num = face_idx + 1
                    
                    if face_num % 2 != 0: # Impar
                        target_page_idx = i
                    else: # Par
                        target_page_idx = num_students_in_batch - 1 - i
                    
                    if target_page_idx < len(pdf_reader.pages):
                        writer.add_page(pdf_reader.pages[target_page_idx])
                    else:
                        log.warning(f"Índice {target_page_idx} fuera de rango para cara {face_num}")

                # 6. Guardar y subir PDF combinado
                combined_buffer = io.BytesIO()
                writer.write(combined_buffer)
                combined_bytes = combined_buffer.getvalue()

                combined_filename = f"examen_{evaluacion.id}_{nombre_alumno.replace(' ', '_')}.pdf"
                self.gcs_client.upload_blob(combined_bytes, combined_filename, "application/pdf")

                # 7. Encolar tarea
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

            log.info(f"✅ Lote procesado: {len(evaluaciones_creadas)} exámenes reconstruidos y encolados")

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
            curso_id: int,  # ✅ Recibir ID
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
                    curso_id=curso_id,  # ✅ Usar ID
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
