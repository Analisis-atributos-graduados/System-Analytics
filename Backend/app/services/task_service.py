import logging
from app.clients import TaskClient

log = logging.getLogger(__name__)


class TaskService:

    def __init__(self, task_client: TaskClient):
        self.task_client = task_client

    def create_file_task(
            self,
            gcs_filename: str,
            original_filename: str,
            evaluacion_id: int,
            tipo_documento: str,
            delay_seconds: int = 0
    ) -> str:

        try:
            task_name = self.task_client.create_file_processing_task(
                gcs_filename=gcs_filename,
                original_filename=original_filename,
                evaluacion_id=evaluacion_id,
                tipo_documento=tipo_documento,
                delay_seconds=delay_seconds
            )

            log.info(f"Tarea de archivo creada: {task_name}")
            return task_name
        except Exception as e:
            log.error(f"Error al crear tarea de archivo: {e}")
            raise

    def create_evaluation_task(
            self,
            evaluacion_id: int,
            delay_seconds: int = 5
    ) -> str:

        try:
            task_name = self.task_client.create_evaluation_task(
                evaluacion_id=evaluacion_id,
                delay_seconds=delay_seconds
            )

            log.info(f"Tarea de evaluación creada: {task_name}")
            return task_name
        except Exception as e:
            log.error(f"Error al crear tarea de evaluación: {e}")
            raise
