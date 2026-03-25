# Aperiodic Monotiles Generator

Generate images based on the "einstein" aperiodic monotile using a small Python CLI.

The project currently focuses on offline image generation. The longer-term goal is to use this generator as the backend for a website where people can tweak colors, size, image dimensions, tile variants, and download finished artwork.

## What It Does

- Renders a full monotile pattern as a JPG image.
- Supports custom output size, scale, subdivision depth, and colors.
- Includes a seed-based export mode for generating a unique cropped section of the pattern.

## Project Structure

```text
.
├── aperiodic-generator      # Executable launcher for GUI or direct CLI rendering
├── src/
│   ├── entry/               # Launcher scripts for CLI and GUI entrypoints
│   └── pattern_generation/  # Source package with the generator code
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

## Cloud Run

The easiest Google Cloud path for this repo is to run it as a tiny HTTP image-generation service on Cloud Run.

This repo now includes:

- `src/entry/web.py` for a small Flask API
- `requirements.txt` for container dependencies
- `Dockerfile` for Cloud Run builds

### Local Container-Friendly Run

Install the service dependencies:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Start the web service locally:

```bash
python3 -m src.entry.web
```

Test it from another terminal:

```bash
curl http://127.0.0.1:8080/healthz
curl -X POST http://127.0.0.1:8080/render \
  -H "Content-Type: application/json" \
  --data '{"iterations":5,"width":1400,"height":1400,"scalar":20,"format":"png"}' \
  --output pattern.png
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
- Cloud Run will expose an HTTPS URL you can call with `POST /render`.

Example request after deploy:

```bash
SERVICE_URL="https://YOUR-SERVICE-URL"
curl -X POST "$SERVICE_URL/render" \
  -H "Content-Type: application/json" \
  --data '{"iterations":5,"width":1600,"height":1600,"scalar":20,"colors":["black","seagreen","white","sandybrown","gold"],"format":"png"}' \
  --output pattern.png
```

Available service endpoints:

- `GET /` returns usage details
- `GET /healthz` returns a simple health response
- `POST /render` returns the generated image directly

`POST /render` JSON fields:

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

These limits are there to reduce the chance of Cloud Run instances timing out or running out of memory.

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
- Earlier inspiration repository: https://github.com/asmoly/Einstein_Tile_Generator
-
