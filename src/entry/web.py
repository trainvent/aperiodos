import os
import subprocess
import sys
import tempfile
from pathlib import Path
from xml.etree import ElementTree

from flask import Flask, jsonify, request, send_file, send_from_directory
from PIL import Image, ImageColor, ImageDraw


LAUNCHER_DIR = Path(__file__).resolve().parent
SRC_PATH = LAUNCHER_DIR.parent
PROJECT_ROOT = LAUNCHER_DIR.parents[1]
FRONTEND_DIST_DIR = PROJECT_ROOT / "web" / "dist"
FRONTEND_ASSETS_DIR = FRONTEND_DIST_DIR / "assets"
DEFAULT_SPECTRE_BINARY = PROJECT_ROOT / "src" / "spectre_rs" / "target" / "release" / "spectre_rs"
DEBUG_SPECTRE_BINARY = PROJECT_ROOT / "src" / "spectre_rs" / "target" / "debug" / "spectre_rs"
DEFAULT_PENROSE_BINARY = PROJECT_ROOT / "penrose" / "target" / "release" / "penrose_rs"
DEBUG_PENROSE_BINARY = PROJECT_ROOT / "penrose" / "target" / "debug" / "penrose_rs"

if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from einstein_backend.cli import (  # noqa: E402
    DEFAULT_COLORS,
    DEFAULT_FOUR_COLORS,
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
MAX_PENROSE_ITERATIONS = 10
MAX_PENROSE_SCALE = 1200
ALLOWED_EINSTEIN_FORMATS = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "svg": "image/svg+xml"}
ALLOWED_SPECTRE_FORMATS = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "svg": "image/svg+xml"}
ALLOWED_PENROSE_FORMATS = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "svg": "image/svg+xml"}

ABOUT_CONTENT = {
    "title": "About Aperiodos",
    "summary": (
        "Aperiodos is a Trainvent subservice for aperiodic monotiles, image generation, "
        "and browser experiments. The site currently centers on monotiles, with plans "
        "to expand into other aperiodic patterns and Penrose tilings."
    ),
    "references": [
        {
            "label": "Trainvent",
            "url": "https://www.trainvent.com/",
        },
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
        "This Trainvent subservice draws on papers, mathematical references, and public "
        "open-source experiments to explore how these tilings can be rendered and presented on the web."
    ),
    "technical_realizations": (
        "OpenAI helped with technical realization work across the project, including architecture "
        "planning, refactors, API shaping, and frontend/backend integration support."
    ),
    "notes": (
        "The Rust-based Spectre work is being adapted into src/spectre_rs, with the older "
        "spectre clone kept as a reference source. Einstein and Spectre share one visual language "
        "inside the broader Trainvent web presence."
    ),
}


def _allowed_cors_origins():
    configured = os.environ.get("CORS_ALLOWED_ORIGINS")
    if configured:
        return {origin.strip() for origin in configured.split(",") if origin.strip()}
    return {
        "https://trainvent.github.io",
        "https://www.aperiodos.com",
        "https://aperiodos.com",
    }


def _apply_cors_headers(response):
    origin = request.headers.get("Origin", "")
    if origin in _allowed_cors_origins():
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


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


def _coerce_four_colors(payload):
    colors = payload.get("four_colors", list(DEFAULT_FOUR_COLORS))
    if not isinstance(colors, list) or len(colors) != 4:
        raise ValueError("'four_colors' must be a list of exactly four CSS-style color values.")
    return tuple(str(color) for color in colors)


def _coerce_einstein_color_mode(payload):
    color_mode = str(payload.get("color_mode", "families"))
    if color_mode not in {"families", "four_color"}:
        raise ValueError("'color_mode' must be 'families' or 'four_color'.")
    return color_mode


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


def _coerce_spectre_draw_mode(payload):
    draw_mode = str(payload.get("draw_mode", "translation"))
    if draw_mode not in {"generated", "translation"}:
        raise ValueError("'draw_mode' must be 'generated' or 'translation'.")
    return draw_mode


def _coerce_spectre_format(payload):
    image_format = str(payload.get("format", "svg")).lower()
    if image_format not in ALLOWED_SPECTRE_FORMATS:
        raise ValueError(f"'format' must be one of: {', '.join(sorted(ALLOWED_SPECTRE_FORMATS))}.")
    return image_format


def _coerce_penrose_seed(payload):
    seed = str(payload.get("seed", "sun"))
    if seed not in {"sun", "star"}:
        raise ValueError("'seed' must be 'sun' or 'star'.")
    return seed


def _coerce_penrose_tile_mode(payload):
    tile_mode = str(payload.get("tile_mode", "kite-dart"))
    if tile_mode not in {"kite-dart", "rhombs"}:
        raise ValueError("'tile_mode' must be 'kite-dart' or 'rhombs'.")
    return tile_mode


def _coerce_penrose_format(payload):
    image_format = str(payload.get("format", "svg")).lower()
    if image_format not in ALLOWED_PENROSE_FORMATS:
        raise ValueError(f"'format' must be one of: {', '.join(sorted(ALLOWED_PENROSE_FORMATS))}.")
    return image_format


def _parse_svg_dimension(raw_value, fallback):
    if not raw_value:
        return fallback
    normalized = str(raw_value).strip().removesuffix("px")
    try:
        return int(round(float(normalized)))
    except ValueError:
        return fallback


def _parse_pillow_color(raw_value):
    if not raw_value or raw_value == "none":
        return None
    return ImageColor.getrgb(str(raw_value))


def _parse_svg_points(raw_points):
    points = []
    for pair in str(raw_points).replace("\n", " ").split():
        x_str, y_str = pair.split(",", 1)
        points.append((float(x_str), float(y_str)))
    return points


def _rasterize_svg(svg_path, output_path, fallback_width, fallback_height, image_format):
    document = ElementTree.parse(svg_path)
    root = document.getroot()
    width = _parse_svg_dimension(root.attrib.get("width"), fallback_width)
    height = _parse_svg_dimension(root.attrib.get("height"), fallback_height)

    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)

    for node in root:
        tag = node.tag.rsplit("}", 1)[-1]
        if tag == "rect":
            fill = _parse_pillow_color(node.attrib.get("fill"))
            if fill is not None:
                draw.rectangle([(0, 0), (width, height)], fill=fill)
        elif tag == "polygon":
            points = _parse_svg_points(node.attrib.get("points", ""))
            fill = _parse_pillow_color(node.attrib.get("fill"))
            outline = _parse_pillow_color(node.attrib.get("stroke"))
            stroke_width = float(node.attrib.get("stroke-width", "1"))
            draw.polygon(
                points,
                fill=fill,
                outline=outline if stroke_width > 0 else None,
                width=max(1, int(round(stroke_width))) if stroke_width > 0 else 0,
            )

    save_format = "JPEG" if image_format in {"jpg", "jpeg"} else "PNG"
    image.save(output_path, format=save_format)


def _frontend_available():
    return FRONTEND_DIST_DIR.exists() and (FRONTEND_DIST_DIR / "index.html").exists()


def _spectre_binary_path():
    configured = os.environ.get("SPECTRE_BIN")
    if configured:
        return Path(configured)

    candidates = [path for path in (DEFAULT_SPECTRE_BINARY, DEBUG_SPECTRE_BINARY) if path.exists()]
    if candidates:
        return max(candidates, key=lambda path: path.stat().st_mtime)
    return None


def _penrose_binary_path():
    configured = os.environ.get("PENROSE_BIN")
    if configured:
        return Path(configured)

    candidates = [path for path in (DEFAULT_PENROSE_BINARY, DEBUG_PENROSE_BINARY) if path.exists()]
    if candidates:
        newest_source = max(
            (
                PROJECT_ROOT / "penrose" / "src" / "main.rs",
                PROJECT_ROOT / "penrose" / "src" / "lib.rs",
                PROJECT_ROOT / "penrose" / "src" / "render.rs",
                PROJECT_ROOT / "penrose" / "src" / "math.rs",
            ),
            key=lambda path: path.stat().st_mtime,
        ).stat().st_mtime
        fresh_candidates = [
            path for path in candidates if path.stat().st_mtime >= newest_source
        ]
        if fresh_candidates:
            return max(fresh_candidates, key=lambda path: path.stat().st_mtime)
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


@app.before_request
def _handle_api_preflight():
    if request.method == "OPTIONS" and request.path.startswith("/api/"):
        return _apply_cors_headers(app.response_class(status=204))


@app.after_request
def _set_cors_headers(response):
    if request.path.startswith("/api/"):
        return _apply_cors_headers(response)
    return response


def _run_spectre_renderer(payload):
    width = _coerce_int(payload, "width", DEFAULT_HTTP_WIDTH, minimum=64, maximum=MAX_IMAGE_DIMENSION)
    height = _coerce_int(payload, "height", DEFAULT_HTTP_HEIGHT, minimum=64, maximum=MAX_IMAGE_DIMENSION)
    level = _coerce_int(payload, "level", 5, minimum=1, maximum=MAX_SPECTRE_LEVEL)
    scale = _coerce_float(payload, "scale", 40.0, minimum=1.0, maximum=MAX_SPECTRE_SCALE)
    center_x = _coerce_float(payload, "center_x", 0.0)
    center_y = _coerce_float(payload, "center_y", 0.0)
    background = str(payload.get("background", "#ffffff"))
    outline = str(payload.get("outline", "black"))
    stroke_width = _coerce_float(payload, "stroke_width", 1.2, minimum=0.0, maximum=20.0)
    palette = _coerce_palette(payload)
    draw_mode = _coerce_spectre_draw_mode(payload)
    image_format = _coerce_spectre_format(payload)

    with tempfile.NamedTemporaryFile(suffix=".svg", delete=False, dir="/tmp") as tmp_file:
        output_path = Path(tmp_file.name)
    raster_output_path = None

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
            "--draw-mode",
            draw_mode,
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

        if image_format in {"png", "jpg", "jpeg"}:
            with tempfile.NamedTemporaryFile(suffix=f".{image_format}", delete=False, dir="/tmp") as raster_file:
                raster_output_path = Path(raster_file.name)
            _rasterize_svg(output_path, raster_output_path, width, height, image_format)
            return send_file(
                raster_output_path,
                mimetype=ALLOWED_SPECTRE_FORMATS[image_format],
                as_attachment=False,
                download_name=f"spectre.{image_format}",
            )

        return send_file(
            output_path,
            mimetype=ALLOWED_SPECTRE_FORMATS[image_format],
            as_attachment=False,
            download_name="spectre.svg",
        )
    finally:
        try:
            os.unlink(output_path)
        except FileNotFoundError:
            pass
        if raster_output_path is not None:
            try:
                os.unlink(raster_output_path)
            except FileNotFoundError:
                pass


def _run_penrose_renderer(payload):
    width = _coerce_int(payload, "width", DEFAULT_HTTP_WIDTH, minimum=64, maximum=MAX_IMAGE_DIMENSION)
    height = _coerce_int(payload, "height", DEFAULT_HTTP_HEIGHT, minimum=64, maximum=MAX_IMAGE_DIMENSION)
    iterations = _coerce_int(payload, "iterations", 7, minimum=0, maximum=MAX_PENROSE_ITERATIONS)
    scale = _coerce_float(payload, "scale", 320.0, minimum=10.0, maximum=MAX_PENROSE_SCALE)
    center_x = _coerce_float(payload, "center_x", 0.0)
    center_y = _coerce_float(payload, "center_y", 0.0)
    background = str(payload.get("background", "#ffffff"))
    outline = str(payload.get("outline", "black"))
    stroke_width = _coerce_float(payload, "stroke_width", 1.0, minimum=0.0, maximum=20.0)
    palette = _coerce_palette(payload)
    seed = _coerce_penrose_seed(payload)
    tile_mode = _coerce_penrose_tile_mode(payload)
    image_format = _coerce_penrose_format(payload)

    with tempfile.NamedTemporaryFile(suffix=".svg", delete=False, dir="/tmp") as tmp_file:
        output_path = Path(tmp_file.name)
    raster_output_path = None

    binary_path = _penrose_binary_path()
    command = [str(binary_path)] if binary_path and binary_path.exists() else ["cargo", "run", "--quiet", "--release", "--"]
    command.extend(
        [
            "--output",
            str(output_path),
            "--width",
            str(width),
            "--height",
            str(height),
            "--iterations",
            str(iterations),
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
            "--seed",
            seed,
            "--tile-mode",
            tile_mode,
        ]
    )

    if palette:
        command.extend(["--palette", ",".join(palette)])

    cwd = PROJECT_ROOT / "penrose" if command[0] == "cargo" else None

    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            stderr = result.stderr.strip() or result.stdout.strip() or "Penrose renderer failed."
            raise RuntimeError(stderr)

        if image_format in {"png", "jpg", "jpeg"}:
            with tempfile.NamedTemporaryFile(suffix=f".{image_format}", delete=False, dir="/tmp") as raster_file:
                raster_output_path = Path(raster_file.name)
            _rasterize_svg(output_path, raster_output_path, width, height, image_format)
            return send_file(
                raster_output_path,
                mimetype=ALLOWED_PENROSE_FORMATS[image_format],
                as_attachment=False,
                download_name=f"penrose.{image_format}",
            )

        return send_file(
            output_path,
            mimetype=ALLOWED_PENROSE_FORMATS[image_format],
            as_attachment=False,
            download_name="penrose.svg",
        )
    finally:
        try:
            os.unlink(output_path)
        except FileNotFoundError:
            pass
        if raster_output_path is not None:
            try:
                os.unlink(raster_output_path)
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
                "POST /api/spectre/render": "Generate a Spectre SVG, PNG, or JPG and return it directly",
                "POST /api/penrose/render": "Generate a Penrose kite-dart or rhomb SVG, PNG, or JPG and return it directly",
            },
            "einstein_example_payload": {
                "iterations": DEFAULT_ITERATIONS,
                "width": DEFAULT_HTTP_WIDTH,
                "height": DEFAULT_HTTP_HEIGHT,
                "scalar": DEFAULT_SCALAR,
                "colors": list(DEFAULT_COLORS),
                "color_mode": "families",
                "four_colors": list(DEFAULT_FOUR_COLORS),
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
                "format": "svg",
                "draw_mode": "translation",
                "palette": ["#1f6a5d", "#b4552d", "#d8b24c", "#17313b"],
                "background": "#ffffff",
                "outline": "black",
                "stroke_width": 1.2,
            },
            "penrose_example_payload": {
                "width": DEFAULT_HTTP_WIDTH,
                "height": DEFAULT_HTTP_HEIGHT,
                "iterations": 7,
                "scale": 320,
                "center_x": 0,
                "center_y": 0,
                "format": "svg",
                "seed": "sun",
                "tile_mode": "kite-dart",
                "palette": ["wheat", "crimson"],
                "background": "white",
                "outline": "black",
                "stroke_width": 1.0,
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
        color_mode = _coerce_einstein_color_mode(payload)
        colors = _coerce_colors(payload)
        four_colors = _coerce_four_colors(payload)
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
                color_mode=color_mode,
                four_colors=four_colors,
                show_window=False,
                draw_outline=not no_outline,
            )
        else:
            seed_value = _coerce_int(payload, "seed", seed, minimum=1)
            seed_to_pattern(
                seed=seed_value,
                output_file_name=str(output_path),
                draw_outline=not no_outline,
                colors=colors,
                color_mode=color_mode,
                four_colors=four_colors,
            )

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


@app.post("/api/penrose/render")
def render_penrose():
    payload = request.get_json(silent=True) or {}
    try:
        return _run_penrose_renderer(payload)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 500
    except FileNotFoundError:
        return jsonify({"error": "Penrose renderer binary not found."}), 500


@app.get("/assets/<path:filename>")
def frontend_assets(filename):
    if not FRONTEND_ASSETS_DIR.exists():
        return jsonify({"error": "Frontend assets not built."}), 404
    return send_from_directory(FRONTEND_ASSETS_DIR, filename)


@app.get("/<path:filename>")
def frontend_public_file(filename):
    file_path = FRONTEND_DIST_DIR / filename
    if file_path.is_file():
        return send_from_directory(FRONTEND_DIST_DIR, filename)
    if request.path.startswith("/api/"):
        return jsonify({"error": "Not found"}), 404
    return _serve_spa()


@app.get("/")
@app.get("/einstein")
@app.get("/spectre")
@app.get("/penrose")
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
