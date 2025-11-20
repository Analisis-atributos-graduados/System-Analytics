"""
Script para descargar el modelo DeBERTa durante el build de Docker.
Esto evita descargar el modelo en cada arranque del contenedor.
"""
import os
import logging
from transformers import AutoTokenizer, AutoModelForSequenceClassification

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

MODEL_DIR = "/app/model"
MODEL_NAME = "MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli"


def download_model():
    """Descarga y guarda el modelo DeBERTa localmente."""
    try:
        log.info(f"📥 Descargando modelo {MODEL_NAME}...")
        log.info("⏳ Este proceso puede tardar varios minutos (~600MB)")

        # Crear directorio si no existe
        os.makedirs(MODEL_DIR, exist_ok=True)

        # Descargar tokenizer
        log.info("Descargando tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        tokenizer.save_pretrained(MODEL_DIR)
        log.info("✅ Tokenizer descargado")

        # Descargar modelo
        log.info("Descargando modelo...")
        model = AutoModelForSequenceClassification.from_pretrained(
            MODEL_NAME,
            num_labels=3
        )
        model.save_pretrained(MODEL_DIR)
        log.info("✅ Modelo descargado")

        # Verificar tamaño
        total_size = sum(
            os.path.getsize(os.path.join(dirpath, filename))
            for dirpath, _, filenames in os.walk(MODEL_DIR)
            for filename in filenames
        )

        log.info(f"✅ Modelo guardado en {MODEL_DIR}")
        log.info(f"📊 Tamaño total: {total_size / (1024 * 1024):.2f} MB")

    except Exception as e:
        log.error(f"❌ Error al descargar modelo: {e}")
        exit(1)


if __name__ == "__main__":
    download_model()
