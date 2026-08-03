#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-aperiodic-monotiles-generator}"
PROJECT_ID="${PROJECT_ID:-aperiodos}"
REGION="${REGION:-europe-west1}"
MAX_INSTANCES="${MAX_INSTANCES:-1}"

gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 1 \
  --max-instances "$MAX_INSTANCES"
