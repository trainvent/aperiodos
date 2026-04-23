# Aperiodic Monotiles Generator

Generate images based on aperiodic monotiles, with a Python Einstein backend and a Rust Spectre renderer.

The project currently focuses on offline image generation. The longer-term goal is to use this generator as the backend for a website where people can tweak colors, size, image dimensions, tile variants, and download finished artwork.

## What It Does

- Renders Einstein tile patterns from Python.
- Includes a seed-based Einstein export mode for generating a unique cropped section of the pattern.
- Includes a new Rust Spectre renderer that writes SVG snapshots.

## Project Structure

```text
.
├── aperiodic-generator      # Executable launcher for the Einstein Python generator
├── src/
│   ├── entry/               # Thin launcher scripts for CLI, GUI, and HTTP entrypoints
│   ├── einstein_backend/    # Einstein backend implementation in Python
│   └── spectre_rs/          # Rust Spectre renderer crate
├── output/                  # Generated images are written here by default
└── README.md
```

## System Packages

On Debian/Ubuntu, install the needed Python packages with:

```bash
sudo apt update
sudo apt install -y python3 python3-pil python3-opencv python3-tk
```

Alternativly you can install the packages via pip:

```bash
pip install pillow tkinter
```

Package notes:

- `python3-pil` is used for the normal image renderer.
- `python3-opencv` is only needed for `--seed` mode.
- `python3-tk` is only needed for `--show-window`.

## Usage
### Web
https://www.aperiodos.com/

### Offline
Generate the default full pattern:

```bash
python3 src/entry/main.py
```

This writes an image to `output/einstein_pattern.jpg`.

Open a small Tk form to choose values visually and run the generator:

```bash
python3 src/entry/main_visual.py
```

The visual launcher remembers your last-used settings and includes one default preset plus three saveable preset slots.

Or launch it like a little desktop-style tool from the project root:

```bash
./aperiodic-generator
```

Pass normal CLI options to the same launcher and it renders directly without opening the GUI:

```bash
./aperiodic-generator \
  --iterations 6 \
  --width 7000 \
  --height 7000 \
  --scalar 24 \
  --colors black seagreen white sandybrown gold \
  --output output/custom-pattern.jpg
```

Generate a larger image with custom colors:

```bash
python3 src/entry/main.py \
  --iterations 6 \
  --width 7000 \
  --height 7000 \
  --scalar 24 \
  --no-outline \
  --colors black seagreen white sandybrown gold \
  --output output/custom-pattern.jpg
```

Generate a seed-based crop:

```bash
python3 src/entry/main.py --seed 6 --output output/seed-6.png
```

Open a Tk preview window while also saving the file:

```bash
python3 src/entry/main.py --show-window
```

### Spectre (Rust)

Generate a Spectre SVG snapshot:

```bash
cargo run --manifest-path src/spectre_rs/Cargo.toml -- \
  --output output/spectre.svg \
  --width 1600 \
  --height 1600 \
  --scale 40 \
  --level 5 \
  --palette '#17313b,#1f6a5d,#b4552d,#d8b24c,#f6f1e8'
```

Useful Spectre flags:

- `--center-x` and `--center-y` move the viewport in world coordinates.
- `--background`, `--outline`, and `--stroke-width` control the SVG styling.
- `--shape straight|curved` chooses straight polygon edges or a curved matching-rule variant.
- `--palette` accepts a comma-separated list of CSS-style colors.

## Cloud Run

The easiest Google Cloud path for this repo is to run it as a tiny HTTP image-generation service on Cloud Run.

This repo now includes:

- `web/` for the React + Vite frontend
- `src/entry/web.py` for the Flask API and frontend static-file serving
- `src/einstein_backend/` for the Einstein backend implementation
- `src/spectre_rs/` for the Rust Spectre renderer
- `requirements.txt` for Python service dependencies
- `Dockerfile` for the single-service Cloud Run build

### Local Container-Friendly Run

Install the Python service dependencies:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Install the frontend dependencies:

```bash
cd web
npm install
cd ..
```

Build the frontend:

```bash
cd web
npm run build
cd ..
```

Start the API/static service locally:

```bash
python3 -m src.entry.web
```

For active frontend work, run the Vite dev server in another terminal:

```bash
cd web
npm run dev
```

Test the API from another terminal:

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

### Deploy To Cloud Run

Pick your Google Cloud project and region:

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud config set run/region europe-west1
```

Enable the required APIs once:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

Deploy directly from the repo:

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
- `--memory 2Gi` is a good starting point for moderate image sizes. Increase it for larger renders.
- Cloud Run will expose an HTTPS URL that serves both the frontend and the API.

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

### Deploy Frontend To GitHub Pages

This repo now also includes a GitHub Pages workflow at `.github/workflows/deploy-pages.yml`.

Important:

- GitHub Pages only publishes the static frontend from `web/`.
- The generator API still needs a separate backend deployment.
- The included workflow builds the frontend for `/Aperiodos/` and points API requests to `https://www.aperiodos.com`.

After pushing to `main`, enable GitHub Pages in the repository settings and use `GitHub Actions` as the source. The Pages URL should be:

```text
https://trainvent.github.io/Aperiodos/
```

`POST /api/einstein/render` JSON fields:

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

`POST /api/spectre/render` JSON fields:

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

These limits are there to reduce the chance of Cloud Run instances timing out or running out of memory while keeping both renderers responsive.

## CLI Options

```text
--iterations    Number of subdivision rounds to render
--scalar        Pixel scale for each tile coordinate
--width         Output image width
--height        Output image height
--output        Output file path
--colors        Five colors for H1, H, T, P, and F tiles
--no-outline    Render filled tiles without black borders
--seed          Generate a seed-based crop instead of the default full render
--show-window   Display a Tk window while rendering
```

## Notes

- Very high iteration counts can become slow and memory-heavy.
- More than 8 iterations can be very heavy to load and render, especially at large output sizes.
- The current codebase is aimed at experimentation and image generation, not yet a polished web app.
- Generated files and Python cache files are intentionally ignored by git.

## References

- David Smith: https://en.wikipedia.org/wiki/David_Smith_(amateur_mathematician)
- Hat monotile reference page: https://cs.uwaterloo.ca/~csk/hat/h7h8.html
- inspiration repository for Einstein: https://github.com/asmoly/Einstein_Tile_Generator
- spectre reference implementation: https://github.com/necocen/spectre
- OpenAIs models where used for most of the technical work: https://openai.com/
- https://mathoverflow.net/questions/443377/how-can-one-construct-a-four-coloring-of-a-tiling-of-the-plane-with-smith-myers
- https://www.chiark.greenend.org.uk/%7Esgtatham/quasiblog/aperiodic-spectre/
- https://www.math.utah.edu/~treiberg/PenroseSlides.pdf
