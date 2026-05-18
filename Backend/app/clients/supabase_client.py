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
        """Obtiene la lista de todos los cursos de Supabase."""
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
        """Obtiene las relaciones de curso_ag de Supabase."""
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
