import logging
import os
import json
from typing import Dict, Optional, List

from app.clients import GCSClient, RapidAPIClient, GeminiClient
from app.extractors import TextExtractor, ImageExtractor, StudentNameMatcher
from app.repositories import ArchivoRepository

log = logging.getLogger(__name__)


class ExtractionService:
    """Coordina la extracción de texto e imágenes de documentos."""

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
        """
        Procesa un archivo completo: extrae texto e imágenes.

        Args:
            gcs_filename: Nombre del archivo en GCS
            original_filename: Nombre original del archivo
            evaluacion_id: ID de la evaluación
            tipo_documento: Tipo de documento
            tema: Tema del documento
            descripcion_tema: Descripción del tema

        Returns:
            Dict con texto extraído y análisis visual
        """
        try:
            log.info(f"Procesando archivo: {gcs_filename}")

            # Descargar archivo de GCS
            file_bytes = self.gcs_client.download_blob(gcs_filename)
            file_extension = os.path.splitext(gcs_filename)[1]

            # Extraer texto
            texto_extraido = self._extract_text(
                file_bytes=file_bytes,
                file_extension=file_extension,
                tipo_documento=tipo_documento
            )

            # Extraer imágenes
            imagenes_base64 = self.image_extractor.extract_images(file_bytes, file_extension)

            # Análisis visual con Gemini (si hay imágenes)
            analisis_visual = None
            if imagenes_base64:
                log.info(f"Analizando {len(imagenes_base64)} imágenes con Gemini")
                try:
                    analisis_visual = self.gemini_client.analyze_images(
                        images_base64=imagenes_base64,
                        tema=tema,
                        descripcion_tema=descripcion_tema
                    )
                except Exception as gemini_error:
                    # ✅ NUEVO: Manejar errores de cuota de Gemini
                    if "429" in str(gemini_error) or "quota" in str(gemini_error).lower():
                        log.warning(f"⚠️ Cuota de Gemini excedida, continuando sin análisis visual")
                        analisis_visual = None
                    else:
                        log.error(f"Error en Gemini: {gemini_error}")
                        analisis_visual = None

            # ✅ CORREGIDO: Guardar en BD sin gcs_filename
            archivo = self.archivo_repo.create_archivo(
                evaluacion_id=evaluacion_id,
                nombre_archivo_original=original_filename,
                texto_extraido=texto_extraido,
                analisis_visual=json.dumps(analisis_visual) if analisis_visual else ""
            )

            log.info(
                f"✅ Archivo procesado: ID={archivo.id}, Texto={len(texto_extraido) if texto_extraido else 0} chars")

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
        """
        Extrae texto de un archivo (directo o con OCR).
        """
        try:
            # Detectar si tiene texto extraíble
            has_text = self.text_extractor.detect_has_extractable_text(file_bytes, file_extension)

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
                # Necesita OCR (exámenes manuscritos)
                log.info("Archivo sin texto extraíble, usando OCR")
                texto = self.ocr_client.ocr_image(file_bytes)

            # Limpiar texto
            if texto:
                texto = self.text_extractor.clean_text(texto)
                log.info(f"Texto extraído: {len(texto)} caracteres")
                return texto
            else:
                log.warning("No se pudo extraer texto")
                return None

        except Exception as e:
            log.error(f"Error en _extract_text: {e}")
            return None
