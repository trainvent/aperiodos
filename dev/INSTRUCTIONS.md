# Developer Instructions

This file collects the setup and deployment guidance that used to live in the main README.

## Repository Layout

- `web/` contains the React + Vite frontend.
- `src/entry/web.py` serves the HTTP API and static frontend assets.
- `src/einstein_backend/` contains the Python Einstein renderer.
- `src/spectre_rs/` contains the Rust Spectre renderer crate.
- `requirements.txt` lists Python service dependencies.
- `Dockerfile` supports container builds and Cloud Run deployment.

## Local Setup

### Python dependencies

Create a virtual environment and install the Python service packages:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

### Frontend dependencies

Install the frontend packages:

```bash
cd web
npm install
cd ..
```

Build the frontend bundle:

```bash
cd web
npm run build
cd ..
```

### Run the local service

Start the HTTP service:

```bash
python3 -m src.entry.web
```

For frontend development, run the Vite server in another terminal:

```bash
cd web
npm run dev
```

### Smoke-test the API

```bash
curl http://127.0.0.1:8080/api/healthz
curl -X POST http://127.0.0.1:8080/api/einstein/render \
  -H "Content-Type: application/json" \
  --data '{"iterations":5,"width":1400,"height":1400,"scalar":20,"format":"png"}' \
  --output pattern.png
curl -X POST http://127.0.0.1:8080/api/spectre/render \
  -H "Content-Type: application/json" \
  --data '{"width":1400,"height":1400,"level":5,"scale":40}' \
  --output spectre.svg
```

## Donations and Sponsors

The donation flow is implemented in `src/donations/stripe_sponsors.py` and exposed through `src/entry/web.py`.

Required environment variables:

```bash
export STRIPE_SECRET_KEY=sk_live_or_test_key
```

Optional environment variables:

```bash
export STRIPE_WEBHOOK_SECRET=whsec_...
export PUBLIC_APP_URL=https://www.aperiodos.com
export DONATION_CURRENCY=eur
export MIN_DONATION_CENTS=100
export SPONSORS_DB_PATH=output/sponsors.sqlite3
```

Main donation endpoints:

- `POST /api/donations/checkout-session`
- `POST /api/stripe/webhook`
- `GET /api/sponsors`

Local webhook forwarding:

```bash
stripe listen --forward-to http://127.0.0.1:8080/api/stripe/webhook
```

## Cloud Run Deployment

Set your project and region:

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud config set run/region europe-west1
```

Enable the required Google Cloud APIs:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

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

- `--concurrency 1` is a safer default because renders can be CPU- and memory-heavy.
- `--memory 2Gi` is a good starting point for moderate image sizes.
- Cloud Run exposes an HTTPS URL that serves both the frontend and the API.

Example request after deploy:

```bash
SERVICE_URL="https://YOUR-SERVICE-URL"
curl -X POST "$SERVICE_URL/api/einstein/render" \
  -H "Content-Type: application/json" \
  --data '{"iterations":5,"width":1600,"height":1600,"scalar":20,"colors":["black","seagreen","white","sandybrown","gold"],"format":"png"}' \
  --output pattern.png
```

Available service endpoints:

- `GET /` serves the React frontend
- `GET /api` returns API usage details
- `GET /api/about` returns references and acknowledgements
- `GET /api/healthz` returns a simple health response
- `POST /api/einstein/render` returns the generated Einstein image directly
- `POST /api/spectre/render` returns the generated Spectre SVG directly

Request payloads:

`POST /api/einstein/render`

```json
{
  "iterations": 5,
  "width": 1600,
  "height": 1600,
  "scalar": 20,
  "colors": ["black", "seagreen", "white", "sandybrown", "gold"],
  "no_outline": false,
  "seed": null,
  "format": "png"
}
```

Service limits:

- `iterations` max: `6`
- `width` and `height` max: `6000`
- `scalar` max: `80`

`POST /api/spectre/render`

```json
{
  "width": 1600,
  "height": 1600,
  "level": 5,
  "scale": 40,
  "center_x": 0,
  "center_y": 0,
  "shape": "straight",
  "palette": ["#17313b", "#1f6a5d", "#b4552d", "#d8b24c", "#f6f1e8"],
  "background": "#f5f1e7",
  "outline": "#17313b",
  "stroke_width": 1.2
}
```

These limits are there to reduce the chance of the service timing out or running out of memory while keeping both renderers responsive.

## GitHub Pages

The repository includes a GitHub Pages workflow at `.github/workflows/deploy-pages.yml`.

Important:

- GitHub Pages only publishes the static frontend from `web/`.
- The generator API still needs a separate backend deployment.
- The workflow builds the frontend for `/Aperiodos/` and points API requests to `https://www.aperiodos.com`.

After pushing to `main`, enable GitHub Pages in repository settings and use `GitHub Actions` as the source. The Pages URL should be:

```text
https://trainvent.github.io/Aperiodos/
```

## System Packages

On Debian/Ubuntu, install the needed Python packages with:

```bash
sudo apt update
sudo apt install -y python3 python3-pil python3-opencv python3-tk
```

Alternatively, install the packages via pip:

```bash
pip install pillow tkinter
```

Package notes:

- `python3-pil` is used for the normal image renderer.
- `python3-opencv` is only needed for `--seed` mode.
- `python3-tk` is only needed for `--show-window`.
