import os
import sys
import tempfile
from pathlib import Path

from flask import Flask, jsonify, render_template_string, request, send_file


LAUNCHER_DIR = Path(__file__).resolve().parent
SRC_PATH = LAUNCHER_DIR.parent

if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from pattern_generation.cli import (  # noqa: E402
    DEFAULT_COLORS,
    DEFAULT_ITERATIONS,
    DEFAULT_SCALAR,
    render_pattern,
)
from pattern_generation.seed_to_pattern import seed_to_pattern  # noqa: E402


app = Flask(__name__)

INDEX_HTML = """
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Aperiodic Monotiles Generator</title>
  <style>
    :root {
      --bg: #f3efe6;
      --panel: rgba(255, 252, 245, 0.92);
      --ink: #17313b;
      --accent: #b4552d;
      --accent-2: #1f6a5d;
      --line: rgba(23, 49, 59, 0.14);
      --shadow: 0 18px 45px rgba(23, 49, 59, 0.14);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(180, 85, 45, 0.18), transparent 28%),
        radial-gradient(circle at top right, rgba(31, 106, 93, 0.18), transparent 30%),
        linear-gradient(180deg, #f7f1e6 0%, var(--bg) 100%);
      min-height: 100vh;
    }

    main {
      width: min(1120px, calc(100% - 32px));
      margin: 0 auto;
      padding: 40px 0 56px;
    }

    .hero {
      display: grid;
      gap: 24px;
      align-items: start;
      margin-bottom: 28px;
    }

    .title {
      margin: 0;
      font-size: clamp(2.4rem, 6vw, 5rem);
      line-height: 0.95;
      letter-spacing: -0.04em;
      max-width: 10ch;
    }

    .lede {
      margin: 0;
      max-width: 56ch;
      font-size: 1.05rem;
      line-height: 1.6;
      color: rgba(23, 49, 59, 0.82);
    }

    .layout {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 24px;
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 24px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
    }

    .controls {
      padding: 22px;
    }

    .controls h2,
    .preview h2 {
      margin: 0 0 16px;
      font-size: 1rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 12px;
    }

    label {
      display: grid;
      gap: 6px;
      font-size: 0.92rem;
    }

    .full {
      grid-column: 1 / -1;
    }

    input,
    select {
      width: 100%;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(23, 49, 59, 0.18);
      background: rgba(255, 255, 255, 0.9);
      color: var(--ink);
      font: inherit;
    }

    .checkbox {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 4px;
      font-size: 0.95rem;
    }

    .checkbox input {
      width: 18px;
      height: 18px;
      margin: 0;
    }

    .swatches {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 6px;
    }

    .actions {
      display: flex;
      gap: 12px;
      margin-top: 20px;
    }

    button,
    .download {
      appearance: none;
      border: 0;
      border-radius: 999px;
      padding: 13px 18px;
      font: inherit;
      text-decoration: none;
      cursor: pointer;
      transition: transform 140ms ease, opacity 140ms ease;
    }

    button:hover,
    .download:hover {
      transform: translateY(-1px);
    }

    .primary {
      background: linear-gradient(135deg, var(--accent) 0%, #d18047 100%);
      color: white;
      font-weight: 700;
      flex: 1;
    }

    .secondary {
      background: rgba(23, 49, 59, 0.08);
      color: var(--ink);
    }

    .preview {
      padding: 22px;
      min-height: 620px;
      display: grid;
      grid-template-rows: auto auto 1fr auto;
      gap: 16px;
    }

    .preview-box {
      border-radius: 20px;
      border: 1px dashed rgba(23, 49, 59, 0.22);
      background:
        linear-gradient(45deg, rgba(255,255,255,0.7) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(255,255,255,0.7) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.7) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.7) 75%);
      background-size: 24px 24px;
      background-position: 0 0, 0 12px, 12px -12px, -12px 0;
      min-height: 420px;
      display: grid;
      place-items: center;
      overflow: hidden;
    }

    .preview-box img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: none;
      background: white;
    }

    .placeholder {
      width: min(80%, 420px);
      text-align: center;
      line-height: 1.6;
      color: rgba(23, 49, 59, 0.7);
    }

    .meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      min-height: 24px;
    }

    .status {
      color: rgba(23, 49, 59, 0.78);
      font-size: 0.96rem;
    }

    .download {
      background: var(--accent-2);
      color: white;
      display: none;
    }

    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
      }

      .preview {
        min-height: unset;
      }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1 class="title">Aperiodic Monotiles Generator</h1>
      <p class="lede">
        Adjust scale, size, and palette,
        then render a new image in the format you like.
      </p>
    </section>

    <section class="layout">
      <form class="panel controls" id="controls">
        <h2>Settings</h2>
        <div class="grid">
          <label>
            Iterations
            <input name="iterations" type="number" min="1" max="6" value="5">
          </label>
          <label>
            Scalar
            <input name="scalar" type="number" min="1" max="80" value="20">
          </label>
          <label>
            Width
            <input name="width" type="number" min="64" max="6000" value="1600">
          </label>
          <label>
            Height
            <input name="height" type="number" min="64" max="6000" value="1600">
          </label>
          <label class="full">
            Format
            <select name="format">
              <option value="png" selected>PNG</option>
              <option value="jpg">JPG</option>
            </select>
          </label>
          <label class="full">
            Seed
            <input name="seed" type="number" min="1" placeholder="Optional">
          </label>
        </div>

        <div class="swatches">
          <label>H1<input name="color_h1" value="black"></label>
          <label>H<input name="color_h" value="seagreen"></label>
          <label>T<input name="color_t" value="white"></label>
          <label>P<input name="color_p" value="sandybrown"></label>
          <label class="full">F<input name="color_f" value="gold"></label>
        </div>

        <label class="checkbox">
          <input name="no_outline" type="checkbox">
          Render without black outlines
        </label>

        <div class="actions">
          <button class="primary" type="submit">Generate Pattern</button>
          <button class="secondary" type="button" id="reset">Reset</button>
        </div>
      </form>

      <section class="panel preview">
        <h2>Preview</h2>
        <div class="meta">
          <div class="status" id="status">Ready to render.</div>
          <a class="download" id="download" download="aperiodic-pattern.png">Download</a>
        </div>
        <div class="preview-box">
          <div class="placeholder" id="placeholder">
            Your generated pattern will appear here. Start with the default settings or try a seed
            value for a cropped variant.
          </div>
          <img id="preview-image" alt="Generated monotile pattern preview">
        </div>
      </section>
    </section>
  </main>

  <script>
    const form = document.getElementById("controls");
    const statusEl = document.getElementById("status");
    const previewImage = document.getElementById("preview-image");
    const placeholder = document.getElementById("placeholder");
    const downloadLink = document.getElementById("download");
    const resetButton = document.getElementById("reset");

    const defaults = {
      iterations: "5",
      scalar: "20",
      width: "1600",
      height: "1600",
      format: "png",
      seed: "",
      color_h1: "black",
      color_h: "seagreen",
      color_t: "white",
      color_p: "sandybrown",
      color_f: "gold",
      no_outline: false
    };

    function resetForm() {
      for (const [key, value] of Object.entries(defaults)) {
        const field = form.elements.namedItem(key);
        if (!field) continue;
        if (field.type === "checkbox") {
          field.checked = value;
        } else {
          field.value = value;
        }
      }
      statusEl.textContent = "Settings reset.";
    }

    async function handleSubmit(event) {
      event.preventDefault();
      statusEl.textContent = "Rendering pattern...";
      downloadLink.style.display = "none";

      const formData = new FormData(form);
      const format = formData.get("format");
      const payload = {
        iterations: Number(formData.get("iterations")),
        scalar: Number(formData.get("scalar")),
        width: Number(formData.get("width")),
        height: Number(formData.get("height")),
        format,
        colors: [
          formData.get("color_h1"),
          formData.get("color_h"),
          formData.get("color_t"),
          formData.get("color_p"),
          formData.get("color_f")
        ],
        no_outline: form.elements.namedItem("no_outline").checked
      };

      const seed = String(formData.get("seed") || "").trim();
      if (seed) {
        payload.seed = Number(seed);
      }

      try {
        const response = await fetch("/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Render failed.");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        previewImage.src = url;
        previewImage.style.display = "block";
        placeholder.style.display = "none";
        downloadLink.href = url;
        downloadLink.download = `aperiodic-pattern.${format}`;
        downloadLink.style.display = "inline-flex";
        statusEl.textContent = "Render complete.";
      } catch (error) {
        statusEl.textContent = error.message || "Render failed.";
      }
    }

    form.addEventListener("submit", handleSubmit);
    resetButton.addEventListener("click", resetForm);
  </script>
</body>
</html>
"""

DEFAULT_HTTP_WIDTH = 1600
DEFAULT_HTTP_HEIGHT = 1600
MAX_IMAGE_DIMENSION = 6000
MAX_ITERATIONS = 6
MAX_SCALAR = 80
ALLOWED_FORMATS = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}


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


def _coerce_colors(payload):
    colors = payload.get("colors", list(DEFAULT_COLORS))
    if not isinstance(colors, list) or len(colors) != 5:
        raise ValueError("'colors' must be a list of exactly five CSS-style color values.")
    return tuple(str(color) for color in colors)


def _coerce_format(payload):
    image_format = str(payload.get("format", "png")).lower()
    if image_format not in ALLOWED_FORMATS:
        raise ValueError(f"'format' must be one of: {', '.join(sorted(ALLOWED_FORMATS))}.")
    return image_format


@app.get("/")
def index():
    return render_template_string(INDEX_HTML)


@app.get("/api")
def api_index():
    return jsonify(
        {
            "service": "aperiodic-monotiles-generator",
            "status": "ok",
            "endpoints": {
                "GET /": "Interactive browser UI",
                "GET /api": "API overview",
                "GET /healthz": "Basic health check",
                "POST /render": "Generate an image and return it directly",
            },
            "example_payload": {
                "iterations": DEFAULT_ITERATIONS,
                "width": DEFAULT_HTTP_WIDTH,
                "height": DEFAULT_HTTP_HEIGHT,
                "scalar": DEFAULT_SCALAR,
                "colors": list(DEFAULT_COLORS),
                "no_outline": False,
                "seed": None,
                "format": "png",
            },
        }
    )


@app.get("/healthz")
def healthcheck():
    return jsonify({"ok": True})


@app.post("/render")
def render():
    payload = request.get_json(silent=True) or {}

    try:
        image_format = _coerce_format(payload)
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
            mimetype=ALLOWED_FORMATS[image_format],
            as_attachment=False,
            download_name=f"aperiodic-pattern{suffix}",
        )
    finally:
        try:
            os.unlink(output_path)
        except FileNotFoundError:
            pass


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
