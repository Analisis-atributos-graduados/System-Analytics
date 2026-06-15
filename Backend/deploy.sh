#!/bin/bash

set -e

DEPLOY_PROJECT_ID="semilleros-493300"
SERVICE_ACCOUNT_EMAIL="121734839794-compute@developer.gserviceaccount.com"
SERVICE_NAME="backend-evalia-sa"
REGION="us-central1"
IMAGE_TAG="$REGION-docker.pkg.dev/$DEPLOY_PROJECT_ID/evalia-repo/analitica-backend"

PERSONAL_PROJECT_ID="evalia-475805"
BUCKET_NAME="analitica-datos-debertav2"
QUEUE_NAME="cola-analisis-v2"
QUEUE_LOCATION="southamerica-east1"

DATABASE_URL=$(grep "DATABASE_URL" .env | head -1 | cut -d '=' -f2- | tr -d '"' | tr -d "'")
RAPIDAPI_KEY=$(grep "RAPIDAPI_KEY" .env | head -1 | cut -d '=' -f2- | tr -d '"' | tr -d "'")
SUPABASE_URL=$(grep "SUPABASE_URL" .env | head -1 | cut -d '=' -f2- | tr -d '"' | tr -d "'")
SUPABASE_KEY=$(grep "SUPABASE_KEY" .env | head -1 | cut -d '=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$DATABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "Error: No se pudo leer DATABASE_URL o SUPABASE_KEY del archivo .env"
  exit 1
fi

echo "Compilando y subiendo imagen a Artifact Registry en el proyecto $DEPLOY_PROJECT_ID..."
gcloud builds submit --project $DEPLOY_PROJECT_ID --tag $IMAGE_TAG

SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --project $DEPLOY_PROJECT_ID --region $REGION --format="value(status.url)" 2>/dev/null || echo "")

echo "Desplegando el servicio $SERVICE_NAME en Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --project $DEPLOY_PROJECT_ID \
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
  --set-env-vars="DATABASE_URL=$DATABASE_URL,RAPIDAPI_KEY=$RAPIDAPI_KEY,GCP_PROJECT_ID=$PERSONAL_PROJECT_ID,GCP_LOCATION=$REGION,QUEUE_LOCATION=$QUEUE_LOCATION,GCS_BUCKET_NAME=$BUCKET_NAME,GCS_QUEUE_NAME=$QUEUE_NAME,SERVICE_ACCOUNT_EMAIL=$SERVICE_ACCOUNT_EMAIL,BUCKET_NAME=$BUCKET_NAME,QUEUE_NAME=$QUEUE_NAME,SUPABASE_URL=$SUPABASE_URL,SUPABASE_KEY=$SUPABASE_KEY,GOOGLE_CLOUD_PROJECT=$DEPLOY_PROJECT_ID,SERVICE_URL=$SERVICE_URL" \
  --service-account=$SERVICE_ACCOUNT_EMAIL

echo "Despliegue completado!"

