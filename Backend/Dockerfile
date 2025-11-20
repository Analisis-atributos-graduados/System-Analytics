# Usa la misma base
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    libgomp1 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar TODA la carpeta app (nueva arquitectura)
COPY app/ ./app/

# Copiar archivos raíz
COPY main.py .
COPY download_model.py .

# Descargar modelo durante build (tu script original funciona)
RUN python download_model.py

# Exponer puerto
EXPOSE 8080

# Comando de inicio
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
