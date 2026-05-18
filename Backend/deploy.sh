#!/bin/bash

set -e

PROJECT_ID="evalia-475805"
BUCKET_NAME="analitica-datos-debertav2"
QUEUE_NAME="cola-analisis-v2"
SERVICE_ACCOUNT_EMAIL="511391059179-compute@developer.gserviceaccount.com"
SERVICE_NAME="analitica-backend"
REGION="us-central1"
QUEUE_LOCATION="southamerica-east1"
IMAGE_TAG="$REGION-docker.pkg.dev/$PROJECT_ID/evalia-repo/analitica-backend"

DATABASE_URL=$(grep "DATABASE_URL" .env | head -1 | cut -d '=' -f2- | tr -d '"' | tr -d "'")
RAPIDAPI_KEY=$(grep "RAPIDAPI_KEY" .env | head -1 | cut -d '=' -f2- | tr -d '"' | tr -d "'")
SUPABASE_URL=$(grep "SUPABASE_URL" .env | head -1 | cut -d '=' -f2- | tr -d '"' | tr -d "'")
SUPABASE_KEY=$(grep "SUPABASE_KEY" .env | head -1 | cut -d '=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$DATABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "Error: No se pudo leer DATABASE_URL o SUPABASE_KEY del archivo .env"
  exit 1
fi

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
  --set-env-vars="DATABASE_URL=$DATABASE_URL,RAPIDAPI_KEY=03619b84a1mshac9641448c45527p160035jsnfb70e34aabdf,GCP_PROJECT_ID=$PROJECT_ID,GCP_LOCATION=$REGION,QUEUE_LOCATION=$QUEUE_LOCATION,GCS_BUCKET_NAME=$BUCKET_NAME,GCS_QUEUE_NAME=$QUEUE_NAME,SERVICE_ACCOUNT_EMAIL=$SERVICE_ACCOUNT_EMAIL,BUCKET_NAME=$BUCKET_NAME,QUEUE_NAME=$QUEUE_NAME,SERVICE_URL=https://analitica-backend-511391059179.us-central1.run.app,SUPABASE_URL=$SUPABASE_URL,SUPABASE_KEY=$SUPABASE_KEY" \
  --service-account=$SERVICE_ACCOUNT_EMAIL

echo "Despliegue completado!"
