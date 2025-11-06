# Usa una imagen base oficial de Python
FROM python:3.11-slim

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia primero el archivo de requerimientos para aprovechar el caché de Docker
COPY requirements.txt .

# Instala las dependencias
# RUN pip install --no-cache-dir -r requirements.txt
# --- NUEVA LÍNEA ---
RUN pip install --no-cache-dir -r requirements.txt google-cloud-iam>=2.14.1

# --- PASOS PARA HORNEAR EL MODELO ---
COPY download_model.py .
RUN python download_model.py

# Copia el resto del código de tu aplicación
COPY . .

# Expone el puerto en el que correrá la aplicación
EXPOSE 8080

# --- COMANDO FINAL PARA PRODUCCIÓN ---
# Un timeout de 5 minutos (300s) es suficiente.
CMD ["gunicorn", "-w", "1", "-k", "uvicorn.workers.UvicornWorker", "--timeout", "300", "-b", "0.0.0.0:8080", "main:app"]

