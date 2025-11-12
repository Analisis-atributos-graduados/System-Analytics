#!/bin/bash
set -e

# === Configuración del Proyecto ===
PROJECT_ID="evalia-475805"
BUCKET_NAME="analitica-datos-debertav2"
QUEUE_NAME="cola-analisis-v2"
DATABASE_URL="postgresql://neondb_owner:npg_0SriAXBldYu8@ep-blue-unit-ackm10ol-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
SERVICE_ACCOUNT_EMAIL="511391059179-compute@developer.gserviceaccount.com"
SERVICE_NAME="analitica-backend"
REGION="southamerica-east1"
IMAGE_TAG="$REGION-docker.pkg.dev/$PROJECT_ID/evalia-repo/analitica-backend"

echo "Desplegando el servicio $SERVICE_NAME con base de datos Neon..."

gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_TAG \
  --execution-environment=gen2 \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory=16Gi \
  --cpu=8 \
  --cpu-boost \
  --timeout=1800 \
  --set-env-vars="DATABASE_URL=$DATABASE_URL,RAPIDAPI_KEY=03619b84a1mshac9641448c45527p160035jsnfb70e34aabdf,GCP_PROJECT_ID=$PROJECT_ID,GCP_LOCATION=$REGION,GCS_BUCKET_NAME=$BUCKET_NAME,GCS_QUEUE_NAME=$QUEUE_NAME,SERVICE_ACCOUNT_EMAIL=$SERVICE_ACCOUNT_EMAIL,BUCKET_NAME=$BUCKET_NAME,QUEUE_NAME=$QUEUE_NAME,SERVICE_URL=https://analitica-backend-511391059179.southamerica-east1.run.app"

echo "✅ Despliegue completado!"
