#!/bin/bash

# --- Script de Despliegue para Google Cloud Run ---

# Detiene el script inmediatamente si un comando falla.
set -e

# --- ¡ACCIÓN REQUERIDA! ---
# Pon aquí el ID de tu NUEVO proyecto de Google Cloud
PROJECT_ID="evalia-475805"

# --- ¡ACCIÓN REQUERIDA! ---
# El nombre del bucket que creaste en el nuevo proyecto
BUCKET_NAME="analitica-datos-debertav2"

# --- ¡ACCIÓN REQUERIDA! ---
# El nombre de la cola de Cloud Tasks que creaste
QUEUE_NAME="cola-de-analisis"

# --- ¡ACCIÓN REQUERIDA! ---
# Pega aquí la URL de conexión COMPLETA que te dio Neon.tech
# (He pegado la tuya, pero quitando el parámetro &channel_binding=require)
DATABASE_URL="postgresql://neondb_owner:npg_0SriAXBldYu8@ep-blue-unit-ackm10ol-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"

# --- ¡ACCIÓN REQUERIDA! ---
# El correo de la CUENTA DE SERVICIO POR DEFECTO DE COMPUTE ENGINE de tu nuevo proyecto
# Ve a IAM -> busca "Compute Engine default service account"
SERVICE_ACCOUNT_EMAIL="511391059179-compute@developer.gserviceaccount.com"

# --- Configuración del Servicio (puedes dejar esto como está) ---
SERVICE_NAME="analitica-backend"
REGION="southamerica-east1"
IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/evalia-repo/analitica-backend"

# --- Comando de Despliegue Simplificado ---
# Eliminamos la bandera --service-account

echo "🚀 Desplegando el servicio '$SERVICE_NAME' con base de datos Neon..."

gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_TAG" \
  --execution-environment=gen2 \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  # --service-account="$SERVICE_ACCOUNT_EMAIL" # <-- Línea eliminada
  --memory=8Gi \
  --cpu=4 \
  --cpu-boost \
  --timeout=600 \
  --set-env-vars=DATABASE_URL="$DATABASE_URL",RAPIDAPI_KEY="03619b84a1mshac9641448c45527p160035jsnfb70e34aabdf",GCP_PROJECT_ID="$PROJECT_ID",GCP_LOCATION="$REGION",GCS_BUCKET_NAME="$BUCKET_NAME",GCS_QUEUE_NAME="$QUEUE_NAME",SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_EMAIL"

echo "✅ ¡Despliegue completado!"

