import logging
import re
from typing import Optional, Tuple
from thefuzz import process as fuzzy_process

log = logging.getLogger(__name__)


class StudentNameMatcher:

    def __init__(self, threshold: int = 70):

        self.threshold = threshold

    def find_student_name(
            self,
            texto: str,
            student_list: list
    ) -> Optional[Tuple[str, int]]:

        if not texto or not student_list:
            log.warning("Texto o lista de estudiantes vacía")
            return None

        patterns = [
            r"(?:nombres? y apellidos|apellidos y nombres?|alumno|estudiante)\s*[:\-\s]\s*([a-zA-Z\sÁÉÍÓÚáéíóúñÑ,'\. ]+)",
            r"^(?:nombre|alumno|estudiante)[:\s]+([a-zA-Z\sÁÉÍÓÚáéíóúñÑ,'\. ]+)"
        ]
        
        text_lines = texto.strip().split("\n")
        potential_names = []

        for line in text_lines:
            line_stripped = line.strip()
            if not line_stripped:
                continue
            for pattern in patterns:
                match = re.search(pattern, line_stripped, re.IGNORECASE)
                if match:
                    name_found = match.group(1).strip()

                    name_found = re.sub(r'[^\w\sÁÉÍÓÚáéíóúñÑ]+$', '', name_found).strip()
                    if name_found:
                        log.info(f"Nombre potencial por patrón: '{name_found}'")
                        potential_names.append(name_found)

        for i, line in enumerate(text_lines):
            line_lower = line.strip().lower()
            if any(line_lower.startswith(keyword) or keyword + ":" in line_lower 
                   for keyword in ["alumno", "nombre", "estudiante"]):
                parts = line.split(":", 1)
                if len(parts) > 1 and parts[1].strip():
                    name_found = parts[1].strip()
                    log.info(f"Nombre en línea de keyword: '{name_found}'")
                    potential_names.append(name_found)
                elif i + 1 < len(text_lines):
                    next_line = text_lines[i + 1].strip()
                    if next_line and len(next_line) > 3:
                        log.info(f"Nombre en línea siguiente: '{next_line}'")
                        potential_names.append(next_line)

        if not potential_names:
            log.info("No se encontraron nombres por patrones, buscando coincidencia directa...")
            texto_lower = ' '.join(texto.lower().split())
            found_direct = []
            for student in student_list:
                student_lower = student.lower()

                if re.search(r'\b' + re.escape(student_lower) + r'\b', texto_lower):
                    log.info(f"Coincidencia directa: '{student}'")
                    found_direct.append(student)
            
            if found_direct:

                best = max(found_direct, key=len)
                log.info(f"Mejor coincidencia directa: '{best}'")
                return (best, 100)

        candidates = potential_names if potential_names else [texto[:3000]]
        
        best_match_name = None
        best_match_score = 0

        cleaned_candidates = []
        for cand in candidates:

             c = re.sub(r'[^\w\sÁÉÍÓÚáéíóúñÑ]', '', cand).strip()
             if len(c) > 2:
                 cleaned_candidates.append(c)
        
        if not cleaned_candidates and not potential_names:

             cleaned_candidates = [self.clean_text_for_matching(texto)]

        for candidate in cleaned_candidates:
            result = fuzzy_process.extractOne(
                candidate,
                student_list,
                score_cutoff=self.threshold
            )
            if result:
                if result[1] > best_match_score:
                    best_match_name = result[0]
                    best_match_score = result[1]

        if best_match_name:
            log.info(f"Match encontrado: '{best_match_name}' (score: {best_match_score})")
            return (best_match_name, best_match_score)
        else:
            log.warning(f"No se encontró nombre con score >= {self.threshold}")
            return None

    def clean_text_for_matching(self, texto: str) -> str:

        if not texto:
            return ""
        
        texto = texto[:3000].lower()
        texto = re.sub(r'[^a-záéíóúñ0-9\s]', ' ', texto)
        texto = " ".join(texto.split())
        return texto
