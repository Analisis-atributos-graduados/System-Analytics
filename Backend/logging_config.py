import logging
import sys

def setup_logging():
    """Configura el logging básico para enviar mensajes a stdout."""
    # Usar un formato claro que incluya timestamp, nivel y mensaje
    log_format = '%(asctime)s,%(msecs)03d - %(levelname)s - %(message)s'
    date_format = '%Y-%m-%d %H:%M:%S'

    # Configurar el logger raíz
    logging.basicConfig(
        level=logging.INFO, # Nivel por defecto, captura INFO, WARNING, ERROR, CRITICAL
        format=log_format,
        datefmt=date_format,
        stream=sys.stdout, # Enviar logs a la salida estándar (visible en Cloud Run)
        force=True # Sobrescribe cualquier configuración existente
    )

    # Opcional: Reducir el nivel de log de librerías muy "habladoras" si es necesario
    # logging.getLogger('some_noisy_library').setLevel(logging.WARNING)

    logging.info("Configuración de logging inicializada.")

# Puedes llamar a setup_logging() al inicio de tu aplicación (ej. en main.py)
# if __name__ == "__main__":
#     setup_logging()
#     logging.debug("Este mensaje DEBUG no se verá (a menos que cambies el nivel a DEBUG)")
#     logging.info("Este mensaje INFO sí se verá.")
#     logging.warning("Este mensaje WARNING también.")
#     try:
#         1 / 0
#     except ZeroDivisionError:
#         logging.error("Este mensaje ERROR se verá.")
#         logging.exception("Este mensaje EXCEPTION incluirá el traceback.")

