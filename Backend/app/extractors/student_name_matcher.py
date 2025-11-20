import logging
import re
from typing import Optional, Tuple
from thefuzz import process as fuzzy_process

log = logging.getLogger(__name__)


class StudentNameMatcher:
    """Encuentra nombres de estudiantes en texto usando fuzzy matching."""

    def __init__(self, threshold: int = 80):
        """
        Args:
            threshold: Umbral de similitud para fuzzy matching (0-100)
        """
        self.threshold = threshold

    def find_student_name(
            self,
            texto: str,
            student_list: list
    ) -> Optional[Tuple[str, int]]:
        """
        Busca el nombre de un estudiante en un texto usando fuzzy matching.

        Args:
            texto: Texto donde buscar el nombre
            student_list: Lista de nombres de estudiantes

        Returns:
            Tupla (nombre_encontrado, score) o None si no encuentra match
        """
        try:
            if not texto or not student_list:
                log.warning("Texto o lista de estudiantes vacía")
                return None

            # Limpiar el texto
            texto_limpio = self.clean_text_for_matching(texto)

            # Intentar fuzzy matching
            result = fuzzy_process.extractOne(
                texto_limpio,
                student_list,
                score_cutoff=self.threshold
            )

            if result:
                nombre_encontrado, score = result[0], result[1]
                log.info(f"Nombre encontrado: '{nombre_encontrado}' (score: {score})")
                return (nombre_encontrado, score)
            else:
                log.warning(f"No se encontró nombre con score >= {self.threshold}")
                return None

        except Exception as e:
            log.error(f"Error en fuzzy matching: {e}")
            return None

    def clean_text_for_matching(self, texto: str) -> str:
        """
        Limpia el texto para mejorar el fuzzy matching.

        Args:
            texto: Texto a limpiar

        Returns:
            Texto limpio
        """
        if not texto:
            return ""

        # Tomar solo las primeras 500 caracteres (nombres suelen estar al inicio)
        texto = texto[:500]

        # Eliminar caracteres especiales excepto letras, números y espacios
        texto = re.sub(r'[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s]', ' ', texto)

        # Eliminar espacios múltiples
        texto = " ".join(texto.split())

        return texto

    def extract_name_from_filename(self, filename: str) -> Optional[str]:
        """
        Intenta extraer un nombre de estudiante del nombre de archivo.

        Útil para ensayos/informes donde el archivo se nombra con el nombre del alumno.

        Args:
            filename: Nombre del archivo (ej: "Juan_Perez_Informe.pdf")

        Returns:
            Nombre extraído o None
        """
        try:
            # Eliminar extensión
            nombre_sin_ext = filename.rsplit('.', 1)[0]

            # Reemplazar guiones bajos y guiones por espacios
            nombre = nombre_sin_ext.replace('_', ' ').replace('-', ' ')

            # Eliminar números y palabras comunes
            palabras_comunes = ['informe', 'ensayo', 'trabajo', 'documento', 'final', 'v1', 'v2']
            tokens = nombre.split()

            tokens_filtrados = [
                t for t in tokens
                if not t.isdigit() and t.lower() not in palabras_comunes
            ]

            if tokens_filtrados:
                nombre_extraido = " ".join(tokens_filtrados)
                log.info(f"Nombre extraído de filename: '{nombre_extraido}'")
                return nombre_extraido
            else:
                return None

        except Exception as e:
            log.error(f"Error al extraer nombre de filename: {e}")
            return None

    def match_with_list(
            self,
            nombre_extraido: str,
            student_list: list
    ) -> Optional[str]:
        """
        Hace match de un nombre extraído con la lista oficial de estudiantes.

        Args:
            nombre_extraido: Nombre extraído (puede estar mal escrito)
            student_list: Lista oficial de estudiantes

        Returns:
            Nombre oficial que mejor coincide o None
        """
        try:
            result = fuzzy_process.extractOne(
                nombre_extraido,
                student_list,
                score_cutoff=self.threshold
            )

            if result:
                nombre_oficial = result[0]
                score = result[1]
                log.info(f"Match encontrado: '{nombre_extraido}' -> '{nombre_oficial}' (score: {score})")
                return nombre_oficial
            else:
                log.warning(f"No se encontró match para '{nombre_extraido}'")
                return None

        except Exception as e:
            log.error(f"Error en match_with_list: {e}")
            return None
