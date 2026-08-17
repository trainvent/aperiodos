#!/usr/bin/env bash
set -euo pipefail
umask 077

PROJECT_ID="${PROJECT_ID:-aperiodos}"
STRIPE_SANDBOX_KEY_SECRET="${STRIPE_SANDBOX_KEY_SECRET:-aperiodos-stripe-sandbox-secret-key}"
STRIPE_SANDBOX_KEY_VERSION="${STRIPE_SANDBOX_KEY_VERSION:-latest}"
SENDGRID_API_KEY_SECRET="${SENDGRID_API_KEY_SECRET:-aperiodos-sendgrid-api-key}"
SENDGRID_API_KEY_VERSION="${SENDGRID_API_KEY_VERSION:-latest}"
STRIPE_SANDBOX_RENDER_CREDITS_PRICE_ID="${STRIPE_SANDBOX_RENDER_CREDITS_PRICE_ID:-price_1U5Mln3SIDKPozJgcMCOuUIE}"
SENDGRID_FROM_EMAIL="${SENDGRID_FROM_EMAIL:-noreply@trainvent.com}"
SENDGRID_FROM_NAME="${SENDGRID_FROM_NAME:-Trainvent Aperiodos}"
SANDBOX_PORT="${SANDBOX_PORT:-3000}"

if [[ ! "$SANDBOX_PORT" =~ ^[0-9]+$ ]] || (( SANDBOX_PORT < 1 || SANDBOX_PORT > 65535 )); then
  echo "SANDBOX_PORT must be an integer between 1 and 65535." >&2
  exit 1
fi

for command_name in gcloud stripe npm mktemp; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command is unavailable: $command_name" >&2
    exit 1
  fi
done

secret_directory="$(mktemp -d)"
stripe_key_file="$secret_directory/stripe-sandbox-key"
sendgrid_key_file="$secret_directory/sendgrid-api-key"
webhook_secret_file="$secret_directory/stripe-webhook-secret"
listener_pid=""

cleanup() {
  if [[ -n "$listener_pid" ]]; then
    kill "$listener_pid" 2>/dev/null || true
  fi
  rm -f "$stripe_key_file" "$sendgrid_key_file" "$webhook_secret_file"
  rmdir "$secret_directory" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

chmod 700 "$secret_directory"

echo "Loading sandbox credentials from Google Secret Manager..."
gcloud secrets versions access "$STRIPE_SANDBOX_KEY_VERSION" \
  --secret="$STRIPE_SANDBOX_KEY_SECRET" \
  --project="$PROJECT_ID" \
  --out-file="$stripe_key_file" >/dev/null
gcloud secrets versions access "$SENDGRID_API_KEY_VERSION" \
  --secret="$SENDGRID_API_KEY_SECRET" \
  --project="$PROJECT_ID" \
  --out-file="$sendgrid_key_file" >/dev/null
chmod 600 "$stripe_key_file" "$sendgrid_key_file"

stripe listen --print-secret > "$webhook_secret_file"
chmod 600 "$webhook_secret_file"
stripe listen \
  --events checkout.session.completed,checkout.session.async_payment_succeeded \
  --forward-to "http://127.0.0.1:$SANDBOX_PORT/api/stripe/webhook" \
  >/dev/null 2>&1 &
listener_pid="$!"

echo "Starting Stripe sandbox with SendGrid delivery enabled."
cd web
SKIP_LOCAL_ENV_FILE=1 \
STRIPE_SANDBOX_SECRET_KEY_FILE="$stripe_key_file" \
STRIPE_SANDBOX_WEBHOOK_SECRET_FILE="$webhook_secret_file" \
STRIPE_SANDBOX_RENDER_CREDITS_PRICE_ID="$STRIPE_SANDBOX_RENDER_CREDITS_PRICE_ID" \
SENDGRID_API_KEY_FILE="$sendgrid_key_file" \
SENDGRID_FROM_EMAIL="$SENDGRID_FROM_EMAIL" \
SENDGRID_FROM_NAME="$SENDGRID_FROM_NAME" \
SANDBOX_PUBLIC_APP_URL="${SANDBOX_PUBLIC_APP_URL:-http://localhost:$SANDBOX_PORT}" \
npm run dev -- --sandbox --port "$SANDBOX_PORT"
