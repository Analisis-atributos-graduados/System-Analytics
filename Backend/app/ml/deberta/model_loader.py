import logging
import os
from functools import lru_cache
from typing import Tuple, Any

log = logging.getLogger(__name__)


class ModelLoader:
    """Carga lazy del modelo DeBERTa (~600MB)."""

    @staticmethod
    @lru_cache(maxsize=1)
    def load_model() -> Tuple[Any, Any]:
        """
        Carga el modelo DeBERTa y tokenizer.
        Se ejecuta solo una vez gracias a @lru_cache.

        Returns:
            Tupla (model, tokenizer)
        """
        try:
            log.info("🔄 Iniciando carga del modelo DeBERTa...")

            from transformers import AutoTokenizer, AutoModelForSequenceClassification
            import torch

            model_path = os.environ.get("MODEL_PATH", "/app/model")

            # Verificar si el modelo existe localmente
            if os.path.exists(model_path):
                log.info(f"Cargando modelo desde {model_path}")
                tokenizer = AutoTokenizer.from_pretrained(model_path)
                model = AutoModelForSequenceClassification.from_pretrained(
                    model_path,
                    num_labels=3
                )
            else:
                log.info("Cargando modelo desde Hugging Face Hub")
                model_name = "MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli"
                tokenizer = AutoTokenizer.from_pretrained(model_name)
                model = AutoModelForSequenceClassification.from_pretrained(
                    model_name,
                    num_labels=3
                )

            # Mover a CPU (Cloud Run no tiene GPU)
            model.eval()

            log.info("✅ Modelo DeBERTa cargado exitosamente")
            return model, tokenizer

        except Exception as e:
            log.error(f"❌ Error al cargar modelo DeBERTa: {e}")
            raise

    @staticmethod
    def get_model() -> Tuple[Any, Any]:
        """
        Obtiene el modelo cargado (lazy loading).

        Returns:
            Tupla (model, tokenizer)
        """
        return ModelLoader.load_model()
