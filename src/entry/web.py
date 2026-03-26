import os
import subprocess
import sys
import tempfile
from pathlib import Path

from flask import Flask, jsonify, request, send_file, send_from_directory


LAUNCHER_DIR = Path(__file__).resolve().parent
SRC_PATH = LAUNCHER_DIR.parent
PROJECT_ROOT = LAUNCHER_DIR.parents[1]
FRONTEND_DIST_DIR = PROJECT_ROOT / "web" / "dist"
FRONTEND_ASSETS_DIR = FRONTEND_DIST_DIR / "assets"
DEFAULT_SPECTRE_BINARY = PROJECT_ROOT / "src" / "spectre_rs" / "target" / "release" / "spectre_rs"
DEBUG_SPECTRE_BINARY = PROJECT_ROOT / "src" / "spectre_rs" / "target" / "debug" / "spectre_rs"

if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from einstein_backend.cli import (  # noqa: E402
    DEFAULT_COLORS,
    DEFAULT_ITERATIONS,
    DEFAULT_SCALAR,
    render_pattern,
)
from einstein_backend.seed_to_pattern import seed_to_pattern  # noqa: E402


app = Flask(__name__)

DEFAULT_HTTP_WIDTH = 1600
DEFAULT_HTTP_HEIGHT = 1600
MAX_IMAGE_DIMENSION = 6000
MAX_ITERATIONS = 6
MAX_SCALAR = 80
MAX_SPECTRE_LEVEL = 8
MAX_SPECTRE_SCALE = 120
ALLOWED_EINSTEIN_FORMATS = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}

ABOUT_CONTENT = {
    "title": "About Aperiodos",
    "summary": (
        "Aperiodos is a small playground for aperiodic monotiles, image generation, "
        "and browser experiments. The site currently centers on monotiles."
        "Plans to expand into other aperiodic patterns and Penrose tilings."
    ),
    "references": [
        {
            "label": "Hat monotile reference page",
            "url": "https://cs.uwaterloo.ca/~csk/hat/h7h8.html",
        },
        {
            "label": "Spectre project page",
            "url": "https://cs.uwaterloo.ca/~csk/spectre/",
        },
        {
            "label": "Earlier Einstein inspiration repo",
            "url": "https://github.com/asmoly/Einstein_Tile_Generator",
        },
        {
            "label": "necocen/spectre",
            "url": "https://github.com/necocen/spectre",
        },
        {
            "label": "OpenAI",
            "url": "https://openai.com/",
        },
    ],
    "credits": (
        "This project draws on papers, mathematical references, and public open-source "
        "experiments to explore how these tilings can be rendered and presented on the web."
    ),
    "technical_realizations": (
        "OpenAI helped with technical realization work across the project, including architecture "
        "planning, refactors, API shaping, and frontend/backend integration support."
    ),
    "notes": (
        "The Rust-based Spectre work is being adapted into src/spectre_rs, with the older "
        "spectre clone kept as a reference source. Einstein and Spectre share one visual language."
    ),
}


def _coerce_int(payload, key, default, minimum=1, maximum=None):
    raw_value = payload.get(key, default)
    try:
        value = int(raw_value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"'{key}' must be an integer.") from exc

    if value < minimum:
        raise ValueError(f"'{key}' must be at least {minimum}.")
    if maximum is not None and value > maximum:
        raise ValueError(f"'{key}' must be at most {maximum}.")
    return value


def _coerce_float(payload, key, default, minimum=None, maximum=None):
    raw_value = payload.get(key, default)
    try:
        value = float(raw_value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"'{key}' must be a number.") from exc

    if minimum is not None and value < minimum:
        raise ValueError(f"'{key}' must be at least {minimum}.")
    if maximum is not None and value > maximum:
        raise ValueError(f"'{key}' must be at most {maximum}.")
    return value


def _coerce_colors(payload):
    colors = payload.get("colors", list(DEFAULT_COLORS))
    if not isinstance(colors, list) or len(colors) != 5:
        raise ValueError("'colors' must be a list of exactly five CSS-style color values.")
    return tuple(str(color) for color in colors)


def _coerce_einstein_format(payload):
    image_format = str(payload.get("format", "png")).lower()
    if image_format not in ALLOWED_EINSTEIN_FORMATS:
        raise ValueError(f"'format' must be one of: {', '.join(sorted(ALLOWED_EINSTEIN_FORMATS))}.")
    return image_format


def _coerce_palette(payload):
    palette = payload.get("palette")
    if palette is None:
        return None
    if not isinstance(palette, list) or not palette:
        raise ValueError("'palette' must be a non-empty list of CSS-style color values.")
    return [str(color) for color in palette]


def _frontend_available():
    return FRONTEND_DIST_DIR.exists() and (FRONTEND_DIST_DIR / "index.html").exists()


def _spectre_binary_path():
    configured = os.environ.get("SPECTRE_BIN")
    if configured:
        return Path(configured)
    if DEFAULT_SPECTRE_BINARY.exists():
        return DEFAULT_SPECTRE_BINARY
    if DEBUG_SPECTRE_BINARY.exists():
        return DEBUG_SPECTRE_BINARY
    return None


def _serve_spa():
    if not _frontend_available():
        return (
            jsonify(
                {
                    "error": "Frontend build not found.",
                    "hint": "Run `npm install` and `npm run build` inside the web directory.",
                }
            ),
            503,
        )
    return send_from_directory(FRONTEND_DIST_DIR, "index.html")


def _run_spectre_renderer(payload):
    width = _coerce_int(payload, "width", DEFAULT_HTTP_WIDTH, minimum=64, maximum=MAX_IMAGE_DIMENSION)
    height = _coerce_int(payload, "height", DEFAULT_HTTP_HEIGHT, minimum=64, maximum=MAX_IMAGE_DIMENSION)
    level = _coerce_int(payload, "level", 5, minimum=1, maximum=MAX_SPECTRE_LEVEL)
    scale = _coerce_float(payload, "scale", 40.0, minimum=1.0, maximum=MAX_SPECTRE_SCALE)
    center_x = _coerce_float(payload, "center_x", 0.0)
    center_y = _coerce_float(payload, "center_y", 0.0)
    background = str(payload.get("background", "#f5f1e7"))
    outline = str(payload.get("outline", "#17313b"))
    stroke_width = _coerce_float(payload, "stroke_width", 1.2, minimum=0.0, maximum=20.0)
    palette = _coerce_palette(payload)

    with tempfile.NamedTemporaryFile(suffix=".svg", delete=False, dir="/tmp") as tmp_file:
        output_path = Path(tmp_file.name)

    binary_path = _spectre_binary_path()
    command = []
    if binary_path and binary_path.exists():
        command = [str(binary_path)]
    else:
        command = ["cargo", "run", "--quiet", "--release", "--"]

    command.extend(
        [
            "--output",
            str(output_path),
            "--width",
            str(width),
            "--height",
            str(height),
            "--level",
            str(level),
            "--scale",
            str(scale),
            "--center-x",
            str(center_x),
            "--center-y",
            str(center_y),
            "--background",
            background,
            "--outline",
            outline,
            "--stroke-width",
            str(stroke_width),
        ]
    )

    if palette:
        command.extend(["--palette", ",".join(palette)])

    cwd = PROJECT_ROOT / "src" / "spectre_rs" if command[0] == "cargo" else None

    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            stderr = result.stderr.strip() or result.stdout.strip() or "Spectre renderer failed."
            raise RuntimeError(stderr)

        return send_file(
            output_path,
            mimetype="image/svg+xml",
            as_attachment=False,
            download_name="spectre.svg",
        )
    finally:
        try:
            os.unlink(output_path)
        except FileNotFoundError:
            pass


@app.get("/api")
def api_index():
    return jsonify(
        {
            "service": "aperiodos",
            "status": "ok",
            "frontend_available": _frontend_available(),
            "endpoints": {
                "GET /api": "API overview",
                "GET /api/healthz": "Basic health check",
                "GET /api/about": "References and acknowledgements",
                "POST /api/einstein/render": "Generate an Einstein image and return it directly",
                "POST /api/spectre/render": "Generate a Spectre SVG and return it directly",
            },
            "einstein_example_payload": {
                "iterations": DEFAULT_ITERATIONS,
                "width": DEFAULT_HTTP_WIDTH,
                "height": DEFAULT_HTTP_HEIGHT,
                "scalar": DEFAULT_SCALAR,
                "colors": list(DEFAULT_COLORS),
                "no_outline": False,
                "seed": None,
                "format": "png",
            },
            "spectre_example_payload": {
                "width": DEFAULT_HTTP_WIDTH,
                "height": DEFAULT_HTTP_HEIGHT,
                "level": 5,
                "scale": 40,
                "center_x": 0,
                "center_y": 0,
                "palette": ["#17313b", "#1f6a5d", "#b4552d", "#d8b24c", "#f6f1e8"],
                "background": "#f5f1e7",
                "outline": "#17313b",
                "stroke_width": 1.2,
            },
        }
    )


@app.get("/api/healthz")
@app.get("/healthz")
def healthcheck():
    return jsonify({"ok": True})


@app.get("/api/about")
def about():
    return jsonify(ABOUT_CONTENT)


@app.post("/api/einstein/render")
@app.post("/render")
def render_einstein():
    payload = request.get_json(silent=True) or {}

    try:
        image_format = _coerce_einstein_format(payload)
        iterations = _coerce_int(payload, "iterations", DEFAULT_ITERATIONS, minimum=1, maximum=MAX_ITERATIONS)
        scalar = _coerce_int(payload, "scalar", DEFAULT_SCALAR, minimum=1, maximum=MAX_SCALAR)
        width = _coerce_int(payload, "width", DEFAULT_HTTP_WIDTH, minimum=64, maximum=MAX_IMAGE_DIMENSION)
        height = _coerce_int(payload, "height", DEFAULT_HTTP_HEIGHT, minimum=64, maximum=MAX_IMAGE_DIMENSION)
        colors = _coerce_colors(payload)
        seed = payload.get("seed")
        no_outline = bool(payload.get("no_outline", False))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    suffix = f".{image_format}"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, dir="/tmp") as tmp_file:
        output_path = Path(tmp_file.name)

    try:
        if seed is None:
            render_pattern(
                iterations=iterations,
                scalar=scalar,
                width=width,
                height=height,
                output=str(output_path),
                colors=colors,
                show_window=False,
                draw_outline=not no_outline,
            )
        else:
            seed_value = _coerce_int(payload, "seed", seed, minimum=1)
            seed_to_pattern(seed=seed_value, output_file_name=str(output_path), draw_outline=not no_outline)

        return send_file(
            output_path,
            mimetype=ALLOWED_EINSTEIN_FORMATS[image_format],
            as_attachment=False,
            download_name=f"aperiodic-pattern{suffix}",
        )
    finally:
        try:
            os.unlink(output_path)
        except FileNotFoundError:
            pass


@app.post("/api/spectre/render")
def render_spectre():
    payload = request.get_json(silent=True) or {}
    try:
        return _run_spectre_renderer(payload)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 500
    except FileNotFoundError:
        return jsonify({"error": "Spectre renderer binary not found."}), 500


@app.get("/assets/<path:filename>")
def frontend_assets(filename):
    if not FRONTEND_ASSETS_DIR.exists():
        return jsonify({"error": "Frontend assets not built."}), 404
    return send_from_directory(FRONTEND_ASSETS_DIR, filename)


@app.get("/")
@app.get("/einstein")
@app.get("/spectre")
@app.get("/about")
def spa_routes():
    return _serve_spa()


@app.errorhandler(404)
def handle_not_found(_error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Not found"}), 404
    return _serve_spa()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
