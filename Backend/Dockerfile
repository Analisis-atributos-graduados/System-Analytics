# Usa imagen base oficial de Python
FROM python:3.11-slim

# Establece variables de entorno
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Instala dependencias del sistema
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Establece directorio de trabajo
WORKDIR /app

# Copia e instala requerimientos
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Descarga modelo ML
COPY download_model.py .
RUN python download_model.py

# ✅ SOLO COPIA LOS ARCHIVOS NECESARIOS (sin archivos viejos)
COPY main.py .
COPY models.py .
COPY schemas.py .
COPY database.py .
COPY logging_config.py .

# Expone puerto
EXPOSE 8080

# Comando final con uvicorn (más estable que gunicorn para FastAPI)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--timeout-keep-alive", "300"]
