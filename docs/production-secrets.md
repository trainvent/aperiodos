# Production secrets

Production secrets are stored in Google Secret Manager and mounted into the
Cloud Run container as read-only files. They are not stored in the repository,
passed as deployment environment-variable values, or printed by `deploy.sh`.
The deployment replaces custom Cloud Run environment variables with its
explicit non-secret list and removes legacy secret-backed environment keys.

## Required secrets

| Secret Manager name | Contents | Runtime file |
| --- | --- | --- |
| `aperiodos-stripe-live-api-key` | Dedicated live restricted key (`rk_live_...`) | `/secrets/stripe-api-key/value` |
| `aperiodos-stripe-live-webhook-secret` | Live endpoint signing secret (`whsec_...`) | `/secrets/stripe-webhook-secret/value` |
| `aperiodos-render-quota-secret` | Stable random HMAC secret, at least 32 characters | `/secrets/render-quota-secret/value` |
| `aperiodos-render-credit-secret` | Separate stable random HMAC secret, at least 32 characters | `/secrets/render-credit-secret/value` |

The application restricted key should begin with only `Checkout Sessions:
Write`; leave other permissions at `None`. Validate the complete flow with an
equivalent sandbox key and inspect Stripe's restricted-key request logs if an
API request needs another permission. Do not reuse a catalog-management CLI
key as the application key.

The live Stripe webhook URL is:

```text
https://www.aperiodos.com/api/stripe/webhook
```

Subscribe it to `checkout.session.completed` and
`checkout.session.async_payment_succeeded`.

## Initial creation

Enable Secret Manager:

```bash
gcloud services enable secretmanager.googleapis.com --project=aperiodos
```

Store Stripe values with a silent prompt so they do not enter shell history:

```bash
read -r -s -p "Live Stripe restricted key: " APERIODOS_SECRET_VALUE; echo
printf '%s' "$APERIODOS_SECRET_VALUE" | gcloud secrets create aperiodos-stripe-live-api-key \
  --project=aperiodos --replication-policy=automatic --data-file=-
unset APERIODOS_SECRET_VALUE

read -r -s -p "Live Stripe webhook signing secret: " APERIODOS_SECRET_VALUE; echo
printf '%s' "$APERIODOS_SECRET_VALUE" | gcloud secrets create aperiodos-stripe-live-webhook-secret \
  --project=aperiodos --replication-policy=automatic --data-file=-
unset APERIODOS_SECRET_VALUE
```

If production already has a quota or credit secret, migrate the exact existing
value using the same silent-prompt pattern. Otherwise, create each once:

```bash
openssl rand -hex 32 | gcloud secrets create aperiodos-render-quota-secret \
  --project=aperiodos --replication-policy=automatic --data-file=-
openssl rand -hex 32 | gcloud secrets create aperiodos-render-credit-secret \
  --project=aperiodos --replication-policy=automatic --data-file=-
```

Grant the Cloud Run runtime service account `roles/secretmanager.secretAccessor`
on these four secrets. Then deploy with `make deploy`. The deployment defaults
to secret version 1 and fails early if a configured version is unavailable.

## Rotation

Add a new Stripe key or webhook secret version with a silent prompt:

```bash
read -r -s -p "New live Stripe restricted key: " APERIODOS_SECRET_VALUE; echo
printf '%s' "$APERIODOS_SECRET_VALUE" | gcloud secrets versions add aperiodos-stripe-live-api-key \
  --project=aperiodos --data-file=-
unset APERIODOS_SECRET_VALUE
```

Deploy the new pinned version:

```bash
STRIPE_API_KEY_VERSION=2 make deploy
```

Use `STRIPE_WEBHOOK_SECRET_VERSION` for webhook-secret rotation. Do not rotate
the render HMAC secrets routinely: changing the quota secret changes visitor
identities, and changing the credit secret invalidates all purchased codes.

Local sandbox development may still use the ignored `.env` file. Those values
are never used by the production deployment.
