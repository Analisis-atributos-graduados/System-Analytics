import logging
import requests
from typing import List, Dict, Optional

from app.config.settings import settings

log = logging.getLogger(__name__)


class SupabaseClient:

    def __init__(self):
        self.url = settings.SUPABASE_URL
        self.key = settings.SUPABASE_KEY
        
        if not self.url or not self.key:
            log.warning("SupabaseClient: SUPABASE_URL o SUPABASE_KEY no configurados en las variables de entorno.")
            self.headers = {}
        else:
            self.headers = {
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}"
            }
        log.info("SupabaseClient inicializado")

    def get_cursos(self) -> List[Dict]:
        if not self.url:
            return []
        try:
            url = f"{self.url.rstrip('/')}/rest/v1/curso"
            log.info("SupabaseClient: Consultando cursos de Supabase...")
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            cursos = response.json()
            log.info(f"SupabaseClient: {len(cursos)} cursos obtenidos exitosamente.")
            return cursos
        except Exception as e:
            log.error(f"SupabaseClient: Error al consultar cursos de Supabase: {e}")
            return []

    def get_curso_ags(self) -> List[Dict]:
        if not self.url:
            return []
        try:
            url = f"{self.url.rstrip('/')}/rest/v1/curso_ag"
            log.info("SupabaseClient: Consultando relaciones curso_ag de Supabase...")
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            relaciones = response.json()
            log.info(f"SupabaseClient: {len(relaciones)} relaciones curso_ag obtenidas exitosamente.")
            return relaciones
        except Exception as e:
            log.error(f"SupabaseClient: Error al consultar relaciones curso_ag de Supabase: {e}")
            return []

    def delete_all_curso_ags(self) -> bool:
        if not self.url:
            return False
        try:
            url = f"{self.url.rstrip('/')}/rest/v1/curso_ag?id_curso_ag=gt.0"
            log.info("SupabaseClient: Eliminando relaciones curso_ag en Supabase...")
            response = requests.delete(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            log.info("SupabaseClient: Todas las relaciones curso_ag eliminadas exitosamente.")
            return True
        except Exception as e:
            log.error(f"SupabaseClient: Error al eliminar relaciones curso_ag: {e}")
            return False

    def insert_curso_ags(self, mappings: List[Dict]) -> bool:
        if not self.url or not mappings:
            return False
        try:
            url = f"{self.url.rstrip('/')}/rest/v1/curso_ag"
            log.info(f"SupabaseClient: Insertando {len(mappings)} relaciones curso_ag en Supabase...")
            headers = {**self.headers, "Content-Type": "application/json"}
            response = requests.post(url, json=mappings, headers=headers, timeout=10)
            response.raise_for_status()
            log.info("SupabaseClient: Relaciones curso_ag insertadas exitosamente.")
            return True
        except Exception as e:
            log.error(f"SupabaseClient: Error al insertar relaciones curso_ag: {e}")
            return False

    def approve_all_curso_ags(self) -> bool:
        if not self.url:
            return False
        try:
            url = f"{self.url.rstrip('/')}/rest/v1/curso_ag?id_curso_ag=gt.0"
            log.info("SupabaseClient: Aprobando todas las relaciones curso_ag en Supabase...")
            headers = {**self.headers, "Content-Type": "application/json"}
            response = requests.patch(url, json={"aprobado": True}, headers=headers, timeout=10)
            response.raise_for_status()
            log.info("SupabaseClient: Todas las relaciones curso_ag aprobadas exitosamente.")
            return True
        except Exception as e:
            log.error(f"SupabaseClient: Error al aprobar relaciones curso_ag: {e}")
            return False
