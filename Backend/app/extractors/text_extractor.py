import logging
import io
import pdfplumber
from docx import Document
from typing import Optional

log = logging.getLogger(__name__)


class TextExtractor:

    def extract_text_from_pdf(self, pdf_bytes: bytes) -> Optional[str]:

        try:
            texto_completo = []

            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                log.info(f"Extrayendo texto de PDF con {len(pdf.pages)} páginas")

                for i, page in enumerate(pdf.pages):
                    texto_pagina = page.extract_text()

                    if texto_pagina:
                        texto_completo.append(texto_pagina)
                        log.debug(f"Página {i + 1}: {len(texto_pagina)} caracteres")
                    else:
                        log.debug(f"Página {i + 1}: sin texto extraíble")

            if texto_completo:
                resultado = "\n".join(texto_completo)
                log.info(f"Texto extraído exitosamente: {len(resultado)} caracteres totales")
                return resultado
            else:
                log.warning("No se pudo extraer texto del PDF")
                return None

        except Exception as e:
            log.error(f"Error al extraer texto de PDF: {e}")
            return None

    def extract_text_from_docx(self, docx_bytes: bytes) -> Optional[str]:

        try:
            doc = Document(io.BytesIO(docx_bytes))

            paragrafos = [p.text for p in doc.paragraphs if p.text.strip()]

            if paragrafos:
                resultado = "\n".join(paragrafos)
                log.info(f"Texto extraído de DOCX: {len(resultado)} caracteres, {len(paragrafos)} párrafos")
                return resultado
            else:
                log.warning("No se pudo extraer texto del DOCX")
                return None

        except Exception as e:
            log.error(f"Error al extraer texto de DOCX: {e}")
            return None

    def detect_has_extractable_text(
            self,
            file_bytes: bytes,
            file_extension: str
    ) -> bool:

        try:
            if file_extension.lower() == '.pdf':
                texto = self.extract_text_from_pdf(file_bytes)
            elif file_extension.lower() in ['.docx', '.doc']:
                texto = self.extract_text_from_docx(file_bytes)
            else:
                log.warning(f"Extensión no soportada: {file_extension}")
                return False

            has_text = texto is not None and len(texto.strip()) > 50

            log.info(f"Archivo {'tiene' if has_text else 'NO tiene'} texto extraíble")
            return has_text

        except Exception as e:
            log.error(f"Error al detectar texto extraíble: {e}")
            return False

    def clean_text(self, texto: str) -> str:

        if not texto:
            return ""

        texto = " ".join(texto.split())

        lineas = [l.strip() for l in texto.split("\n") if l.strip()]
        texto_limpio = "\n".join(lineas)

        log.debug(f"Texto limpiado: {len(texto)} -> {len(texto_limpio)} caracteres")
        return texto_limpio
