import logging
import io
import base64
from typing import List
from PIL import Image
import fitz  # PyMuPDF
from docx import Document

log = logging.getLogger(__name__)


class ImageExtractor:
    """Extrae imágenes de archivos PDF y DOCX."""

    def __init__(self, max_images: int = 20):
        """
        Args:
            max_images: Número máximo de imágenes a extraer por documento
        """
        self.max_images = max_images

    def extract_images_from_pdf(self, pdf_bytes: bytes) -> List[str]:
        """
        Extrae imágenes de un PDF usando PyMuPDF (fitz).

        Args:
            pdf_bytes: Bytes del archivo PDF

        Returns:
            Lista de imágenes en formato base64
        """
        try:
            images_base64 = []

            with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
                log.info(f"Extrayendo imágenes de PDF con {len(doc)} páginas")

                for page_num in range(len(doc)):
                    page = doc[page_num]
                    image_list = page.get_images(full=True)

                    for img_index, img in enumerate(image_list):
                        if len(images_base64) >= self.max_images:
                            log.info(f"Límite de {self.max_images} imágenes alcanzado")
                            return images_base64

                        try:
                            xref = img[0]
                            base_image = doc.extract_image(xref)
                            image_bytes = base_image["image"]

                            # Convertir a PNG si es necesario
                            image_pil = Image.open(io.BytesIO(image_bytes))

                            # Convertir a RGB si es CMYK u otro modo
                            if image_pil.mode != "RGB":
                                image_pil = image_pil.convert("RGB")

                            # Guardar como PNG en memoria
                            png_buffer = io.BytesIO()
                            image_pil.save(png_buffer, format="PNG")
                            png_bytes = png_buffer.getvalue()

                            # Convertir a base64
                            img_b64 = base64.b64encode(png_bytes).decode('utf-8')
                            images_base64.append(img_b64)

                            log.debug(f"Imagen extraída: página {page_num + 1}, índice {img_index}")

                        except Exception as e:
                            log.warning(f"Error al extraer imagen {img_index} de página {page_num + 1}: {e}")
                            continue

            log.info(f"Total de imágenes extraídas del PDF: {len(images_base64)}")
            return images_base64

        except Exception as e:
            log.error(f"Error al extraer imágenes de PDF: {e}")
            return []

    def extract_images_from_docx(self, docx_bytes: bytes) -> List[str]:
        """
        Extrae imágenes de un archivo DOCX.

        Args:
            docx_bytes: Bytes del archivo DOCX

        Returns:
            Lista de imágenes en formato base64
        """
        try:
            doc = Document(io.BytesIO(docx_bytes))
            images_base64 = []

            # Iterar por las relaciones del documento (donde están las imágenes)
            for rel in doc.part.rels.values():
                if "image" in rel.target_ref:
                    if len(images_base64) >= self.max_images:
                        log.info(f"Límite de {self.max_images} imágenes alcanzado")
                        break

                    try:
                        image_bytes = rel.target_part.blob

                        # Convertir a PNG
                        image_pil = Image.open(io.BytesIO(image_bytes))

                        if image_pil.mode != "RGB":
                            image_pil = image_pil.convert("RGB")

                        png_buffer = io.BytesIO()
                        image_pil.save(png_buffer, format="PNG")
                        png_bytes = png_buffer.getvalue()

                        # Convertir a base64
                        img_b64 = base64.b64encode(png_bytes).decode('utf-8')
                        images_base64.append(img_b64)

                        log.debug(f"Imagen extraída de DOCX")

                    except Exception as e:
                        log.warning(f"Error al extraer imagen de DOCX: {e}")
                        continue

            log.info(f"Total de imágenes extraídas del DOCX: {len(images_base64)}")
            return images_base64

        except Exception as e:
            log.error(f"Error al extraer imágenes de DOCX: {e}")
            return []

    def extract_images(
            self,
            file_bytes: bytes,
            file_extension: str
    ) -> List[str]:
        """
        Extrae imágenes de un archivo (detecta automáticamente PDF o DOCX).

        Args:
            file_bytes: Bytes del archivo
            file_extension: Extensión del archivo ('.pdf' o '.docx')

        Returns:
            Lista de imágenes en formato base64
        """
        try:
            if file_extension.lower() == '.pdf':
                return self.extract_images_from_pdf(file_bytes)
            elif file_extension.lower() in ['.docx', '.doc']:
                return self.extract_images_from_docx(file_bytes)
            else:
                log.warning(f"Extensión no soportada para extracción de imágenes: {file_extension}")
                return []
        except Exception as e:
            log.error(f"Error al extraer imágenes: {e}")
