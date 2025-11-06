import os
from transformers import pipeline

# Define el directorio donde se guardará el modelo dentro de la imagen
model_dir = "/app/model"
model_name = "facebook/bart-large-mnli"

print(f"Descargando el modelo '{model_name}' a la carpeta '{model_dir}'...")
print("(Este proceso puede tardar varios minutos)")

try:
    # Asegúrate de que el directorio exista
    os.makedirs(model_dir, exist_ok=True)

    # Descarga el modelo y el tokenizador, guardándolos en la carpeta especificada
    # Usar 'pipeline' es una forma fácil de asegurar que todo lo necesario se descargue
    pipe = pipeline("zero-shot-classification", model=model_name)
    pipe.save_pretrained(model_dir)

    print(f"¡Modelo '{model_name}' descargado y guardado exitosamente en '{model_dir}'!")

except Exception as e:
    print(f"\nERROR: Ocurrió un error durante la descarga del modelo: {e}")
    # Salir con un código de error para que Cloud Build falle si la descarga no funciona
    exit(1)

