#!/bin/bash

set -e

# === Configuración del Proyecto ===
PROJECT_ID="evalia-475805"
BUCKET_NAME="analitica-datos-debertav2"
QUEUE_NAME="cola-analisis-v2"
DATABASE_URL="postgresql://neondb_owner:npg_0SriAXBldYu8@ep-blue-unit-ackm10ol-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
SERVICE_ACCOUNT_EMAIL="511391059179-compute@developer.gserviceaccount.com"
SERVICE_NAME="analitica-backend"
REGION="us-central1"
QUEUE_LOCATION="southamerica-east1"
IMAGE_TAG="$REGION-docker.pkg.dev/$PROJECT_ID/evalia-repo/analitica-backend"
GEMINI_API_KEY="AIzaSyBukzNFi_p3qw6nupQrS8ZwJdp-F49qF-4"

echo "Desplegando el servicio $SERVICE_NAME con base de datos Neon..."

gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_TAG \
  --execution-environment=gen2 \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory=8Gi \
  --cpu=4 \
  --cpu-boost \
  --timeout=1800 \
  --concurrency=1 \
  --min-instances=0 \
  --max-instances=2 \
  --set-env-vars="DATABASE_URL=$DATABASE_URL,RAPIDAPI_KEY=03619b84a1mshac9641448c45527p160035jsnfb70e34aabdf,GCP_PROJECT_ID=$PROJECT_ID,GCP_LOCATION=$REGION,QUEUE_LOCATION=$QUEUE_LOCATION,GCS_BUCKET_NAME=$BUCKET_NAME,GCS_QUEUE_NAME=$QUEUE_NAME,SERVICE_ACCOUNT_EMAIL=$SERVICE_ACCOUNT_EMAIL,BUCKET_NAME=$BUCKET_NAME,QUEUE_NAME=$QUEUE_NAME,GEMINI_API_KEY=$GEMINI_API_KEY,SERVICE_URL=https://analitica-backend-511391059179.us-central1.run.app" \
  --service-account=$SERVICE_ACCOUNT_EMAIL

echo "✅ Despliegue completado!"
