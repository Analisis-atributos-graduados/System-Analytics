import logging
import json
from typing import Dict, Any
from google.cloud import tasks_v2
from google.protobuf import timestamp_pb2
import datetime

from app.config.settings import settings

log = logging.getLogger(__name__)


class TaskClient:

    def __init__(self):
        self.client = tasks_v2.CloudTasksClient()
        self.project_id = settings.GCP_PROJECT_ID
        self.location = settings.QUEUE_LOCATION
        self.queue_name = settings.QUEUE_NAME
        self.service_url = settings.SERVICE_URL

        self.queue_path = self.client.queue_path(
            self.project_id,
            self.location,
            self.queue_name
        )

        log.info(f"TaskClient inicializado. Queue: {self.queue_path}")

    def create_task(
            self,
            relative_uri: str,
            payload: Dict[Any, Any],
            delay_seconds: int = 0
    ) -> str:

        try:

            url = f"{self.service_url}{relative_uri}"

            payload_bytes = json.dumps(payload).encode('utf-8')

            task = {
                "http_request": {
                    "http_method": tasks_v2.HttpMethod.POST,
                    "url": url,
                    "headers": {
                        "Content-Type": "application/json"
                    },
                    "body": payload_bytes
                }
            }

            if delay_seconds > 0:
                d = datetime.datetime.utcnow() + datetime.timedelta(seconds=delay_seconds)
                timestamp = timestamp_pb2.Timestamp()
                timestamp.FromDatetime(d)
                task["schedule_time"] = timestamp

            response = self.client.create_task(
                request={
                    "parent": self.queue_path,
                    "task": task
                }
            )

            log.info(f"Tarea creada: {response.name} -> {url}")
            return response.name

        except Exception as e:
            log.error(f"Error al crear tarea para {relative_uri}: {e}")
            raise

    def create_file_processing_task(
            self,
            gcs_filename: str,
            original_filename: str,
            evaluacion_id: int,
            tipo_documento: str = "examen",
            precomputed_ocr_text: str = None,
            delay_seconds: int = 0
    ) -> str:

        payload = {
            "gcs_filename": gcs_filename,
            "original_filename": original_filename,
            "evaluacion_id": evaluacion_id,
            "tipo_documento": tipo_documento,
            "precomputed_ocr_text": precomputed_ocr_text
        }

        return self.create_task(
            relative_uri="/process-file-task",
            payload=payload,
            delay_seconds=delay_seconds
        )

    def create_evaluation_task(
            self,
            evaluacion_id: int,
            delay_seconds: int = 5
    ) -> str:

        payload = {
            "evaluacion_id": evaluacion_id
        }

        return self.create_task(
            relative_uri="/process-evaluation-task",
            payload=payload,
            delay_seconds=delay_seconds
        )
