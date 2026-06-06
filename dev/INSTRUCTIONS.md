# Developer Instructions

## Repository Layout

- `web/` contains the Next.js web app, API routes, Stripe donation flow, and Firestore sponsor reads/writes.
- `src/generators/einstein_backend/` contains the Python Einstein generator.
- `src/generators/spectre_rs/` contains the Rust Spectre renderer crate.
- `src/generators/penrose/` contains the Rust Penrose renderer crate.
- `requirements.txt` lists Python packages needed by the Python generator only.
- `Dockerfile` builds a Next.js server image with Python/Rust generators available at runtime.

## Local Setup

Install Python generator dependencies:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Install web dependencies:

```bash
cd web
npm install
cd ..
```

Build Rust generators when you want local API routes to use binaries instead of `cargo run` fallbacks:

```bash
cargo build --release --manifest-path src/generators/spectre_rs/Cargo.toml
cargo build --release --manifest-path src/generators/penrose/Cargo.toml
```

## Run Locally

Start the Next.js web/API server:

```bash
cd web
npm run dev
```

Smoke-test the API:

```bash
curl http://127.0.0.1:3000/api/healthz
curl -X POST http://127.0.0.1:3000/api/einstein/render \
  -H "Content-Type: application/json" \
  --data '{"iterations":5,"width":1400,"height":1400,"scalar":20,"format":"png"}' \
  --output pattern.png
curl -X POST http://127.0.0.1:3000/api/spectre/render \
  -H "Content-Type: application/json" \
  --data '{"width":1400,"height":1400,"level":5,"scale":40}' \
  --output spectre.svg
```

## Donations And Sponsors

The donation flow is implemented in Next API routes under `web/pages/api/`.

Required environment variable:

```bash
export STRIPE_SECRET_KEY=sk_live_or_test_key
```

Sandbox mode uses separate env vars:

```bash
export STRIPE_MODE=sandbox
export STRIPE_SANDBOX_SECRET_KEY=sk_test_or_sandbox_key
export STRIPE_SANDBOX_WEBHOOK_SECRET=whsec_...
```

For local development, prefer the sandbox runner:

```bash
cd web
npm run dev --sandbox
```

It loads the repo-root `.env`, forces `STRIPE_MODE=sandbox`, uses
`STRIPE_SANDBOX_SECRET_KEY`, and writes sponsors to `.sandbox/sponsors.json`
instead of Firestore. Set `SANDBOX_PUBLIC_APP_URL` if Stripe should redirect to
a tunnel URL instead of `http://localhost:3000`.

Optional environment variables:

```bash
export STRIPE_WEBHOOK_SECRET=whsec_...
export PUBLIC_APP_URL=https://www.aperiodos.com
export DONATION_CURRENCY=eur
export MIN_DONATION_CENTS=100
export FIRESTORE_PROJECT_ID=your-gcp-project-id
export FIRESTORE_DATABASE_ID='(default)'
```

Main donation endpoints:

- `POST /api/donations/checkout-session`
- `POST /api/donations/confirm-session`
- `POST /api/stripe/webhook`
- `GET /api/sponsors`

Local webhook forwarding:

```bash
stripe listen --forward-to http://127.0.0.1:3000/api/stripe/webhook
```

## Cloud Run Deployment

Deploy directly from the repository:

```bash
gcloud run deploy aperiodic-monotiles-generator \
  --source . \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 1 \
  --max-instances 3
```

Notes:

- The container runs `next start` via the standalone Next server.
- `--concurrency 1` is a safer default because renders can be CPU- and memory-heavy.
- Cloud Run exposes one HTTPS URL for both pages and `/api/*`.

Available service endpoints:

- `GET /`
- `GET /api`
- `GET /api/about`
- `GET /api/healthz`
- `POST /api/einstein/render`
- `POST /api/spectre/render`
- `POST /api/penrose/render`

## System Packages

On Debian/Ubuntu, install the optional desktop preview dependencies only if you are working directly with the Python generator internals:

```bash
sudo apt-get install python3-tk
```
