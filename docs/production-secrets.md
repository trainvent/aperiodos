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
| `aperiodos-sendgrid-api-key` | Restricted SendGrid key with Mail Send access | `/secrets/sendgrid-api-key/value` |

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
on these five secrets. Then deploy with `make deploy`. The deployment defaults
to secret version 1 and fails early if a configured version is unavailable.

The deployment sends from `noreply@trainvent.com` with the name
`Trainvent Aperiodos`. The address or its domain must be authenticated in
SendGrid. Override it without changing code when needed:

```bash
SENDGRID_FROM_EMAIL=verified-sender@example.com make deploy
```

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

For a complete local sandbox with automatic Stripe webhook forwarding, run:

```bash
make dev-sandbox
```

The launcher retrieves `aperiodos-stripe-sandbox-secret-key` and
`aperiodos-sendgrid-api-key` from Google Secret Manager into mode-`0600`
temporary files. It generates a fresh Stripe CLI webhook signing secret, starts
the listener and Next.js together, and deletes all three files when the process
exits. Secret values are never placed in command-line arguments or environment
variables; only temporary file paths are passed to the application. The normal
ignored `.env` files are deliberately skipped for this command.

The sandbox Price ID is non-secret and has a checked-in default. Secret names,
versions, sender details, and project can be overridden for one run, for example:

```bash
SENDGRID_FROM_EMAIL=verified-sender@example.com \
STRIPE_SANDBOX_KEY_VERSION=2 \
make dev-sandbox
```

The app and webhook listener use port `3000`. If that port is occupied by an
unrelated service, select another one consistently with
`SANDBOX_PORT=3001 make dev-sandbox`. Stop an already-running Next development
server for this repository first because Next permits only one per worktree.

SendGrid has no separate delivery sandbox in this setup: a successful Stripe
sandbox payment sends a real message to the test customer's email address.
