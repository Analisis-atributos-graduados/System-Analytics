import logging
import os
import json
from typing import Dict, Optional, List

from app.clients import GCSClient, RapidAPIClient, GeminiClient
from app.extractors import TextExtractor, ImageExtractor, StudentNameMatcher
from app.repositories import ArchivoRepository

log = logging.getLogger(__name__)


class ExtractionService:

    def __init__(
            self,
            gcs_client: GCSClient,
            ocr_client: RapidAPIClient,
            gemini_client: GeminiClient,
            text_extractor: TextExtractor,
            image_extractor: ImageExtractor,
            student_matcher: StudentNameMatcher,
            archivo_repo: ArchivoRepository
    ):
        self.gcs_client = gcs_client
        self.ocr_client = ocr_client
        self.gemini_client = gemini_client
        self.text_extractor = text_extractor
        self.image_extractor = image_extractor
        self.student_matcher = student_matcher
        self.archivo_repo = archivo_repo

    def process_file(
            self,
            gcs_filename: str,
            original_filename: str,
            evaluacion_id: int,
            tipo_documento: str,
            tema: str,
            descripcion_tema: str
    ) -> Dict:

        try:
            log.info(f"Procesando archivo: {gcs_filename}")

            file_bytes = self.gcs_client.download_blob(gcs_filename)
            file_extension = os.path.splitext(gcs_filename)[1]

            texto_extraido = self._extract_text(
                file_bytes=file_bytes,
                file_extension=file_extension,
                tipo_documento=tipo_documento
            )

            imagenes_base64 = self.image_extractor.extract_images(file_bytes, file_extension)

            analisis_visual = None

            archivo = self.archivo_repo.create_archivo(
                evaluacion_id=evaluacion_id,
                nombre_archivo_original=original_filename,
                texto_extraido=texto_extraido,
                analisis_visual=json.dumps(analisis_visual) if analisis_visual else ""
            )

            log.info(
                f"Archivo procesado: ID={archivo.id}, Texto={len(texto_extraido) if texto_extraido else 0} chars")

            return {
                'archivo_id': archivo.id,
                'texto_extraido': texto_extraido,
                'analisis_visual': analisis_visual,
                'imagenes_count': len(imagenes_base64)
            }

        except Exception as e:
            log.error(f"Error en process_file: {e}")
            raise

    def _extract_text(
            self,
            file_bytes: bytes,
            file_extension: str,
            tipo_documento: str
    ) -> Optional[str]:

        try:
            has_text = self.text_extractor.detect_has_extractable_text(file_bytes, file_extension)

            log.warning(f"DEBUG: has_text={has_text}, extension={file_extension}")

            if has_text:
                log.info("Archivo con texto extraíble, extrayendo directamente")
                if file_extension.lower() == '.pdf':
                    texto = self.text_extractor.extract_text_from_pdf(file_bytes)
                elif file_extension.lower() in ['.docx', '.doc']:
                    texto = self.text_extractor.extract_text_from_docx(file_bytes)
                else:
                    log.warning(f"Extensión no soportada: {file_extension}")
                    return None
            else:
                log.warning("DEBUG: Entrando a bloque OCR")
                log.info("Archivo sin texto extraíble, usando OCR")
                
                if file_extension.lower() == '.pdf':
                    import fitz
                    doc = fitz.open(stream=file_bytes, filetype="pdf")
                    images_list = []
                    
                    log.info(f"PDF multipágina detectado: {len(doc)} páginas")
                    
                    for page in doc:
                        pix = page.get_pixmap()
                        img_bytes = pix.tobytes("png")
                        images_list.append(img_bytes)
                        
                    textos_paginas = self.ocr_client.ocr_multiple_images(images_list)

                    texto = "\n\n".join([t for t in textos_paginas if t])
                    
                else:
                    texto = self.ocr_client.ocr_image(file_bytes)

            if texto:
                log.info(f"Texto extraído: {len(texto)} caracteres")
                return texto
            else:
                log.warning("No se pudo extraer texto")
                return None

        except Exception as e:
            log.error(f"Error en _extract_text: {e}")
            return None
