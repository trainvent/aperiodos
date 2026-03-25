gcloud run deploy aperiodic-monotiles-generator \
  --source . \
  --region=europe-west1 \
  --project=aperiodos \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 1 \
  --max-instances 3
