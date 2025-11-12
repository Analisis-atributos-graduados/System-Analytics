import os
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# Define el directorio donde se guardará el modelo dentro de la imagen
model_dir = "/app/model"

# Modelo a descargar (puede ser BART o DeBERTa según tu elección)
model_name = "MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli"


print(f"Descargando modelo '{model_name}' para inferencia directa...")
print("(Este proceso puede tardar varios minutos)")

try:
    # Asegúrate de que el directorio exista
    os.makedirs(model_dir, exist_ok=True)

    # Descargar tokenizer y modelo (NO como pipeline)
    print("Descargando tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    tokenizer.save_pretrained(model_dir)

    print("Descargando modelo...")
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name,
        num_labels=3  # Ajusta según tus clases
    )
    model.save_pretrained(model_dir)

    print(f"✓ Modelo guardado exitosamente en '{model_dir}'")
    print(f"  Tamaño: ~600MB")

except Exception as e:
    print(f"\nERROR: Ocurrió un error durante la descarga del modelo: {e}")
    # Salir con un código de error para que Cloud Build falle si la descarga no funciona
    exit(1)
