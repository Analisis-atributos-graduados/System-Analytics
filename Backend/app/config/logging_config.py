import logging
import sys


def setup_logging():
    """
    Configura el logging para toda la aplicación.
    Envía logs a stdout (requerido por Cloud Run).
    """
    log_format = "%(asctime)s.%(msecs)03d - %(name)s - %(levelname)s - %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"

    # Configurar logging básico
    logging.basicConfig(
        level=logging.INFO,
        format=log_format,
        datefmt=date_format,
        stream=sys.stdout,
        force=True
    )

    # Configurar loggers específicos

    # Reducir verbosidad de librerías externas
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("google").setLevel(logging.WARNING)
    logging.getLogger("transformers").setLevel(logging.WARNING)
    logging.getLogger("torch").setLevel(logging.WARNING)

    # Mantener nivel INFO para la aplicación
    logging.getLogger("app").setLevel(logging.INFO)

    logging.info("✅ Sistema de logging configurado")
