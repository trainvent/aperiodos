import os
import sys
import tempfile
from pathlib import Path

from flask import Flask, abort, jsonify, render_template_string, request, send_file, send_from_directory


LAUNCHER_DIR = Path(__file__).resolve().parent
SRC_PATH = LAUNCHER_DIR.parent
PROJECT_ROOT = LAUNCHER_DIR.parents[2]
SPECTRE_DIR = PROJECT_ROOT / "spectre"
SPECTRE_INDEX_PATH = SPECTRE_DIR / "index.html"
SPECTRE_PKG_DIR = SPECTRE_DIR / "pkg"
SPECTRE_PKG_JS_PATH = SPECTRE_PKG_DIR / "spectre.js"

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

HOME_HTML = """
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Aperiodos</title>
  <style>
    :root {
      --bg: #f5f1e7;
      --panel: rgba(255, 252, 245, 0.9);
      --ink: #17313b;
      --accent: #b4552d;
      --accent-2: #1f6a5d;
      --line: rgba(23, 49, 59, 0.14);
      --shadow: 0 24px 60px rgba(23, 49, 59, 0.14);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(180, 85, 45, 0.22), transparent 28%),
        radial-gradient(circle at top right, rgba(31, 106, 93, 0.18), transparent 30%),
        linear-gradient(180deg, #fbf7ef 0%, var(--bg) 100%);
      min-height: 100vh;
    }

    main {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 36px 0 56px;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 36px;
      font-size: 0.95rem;
    }

    .brand {
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .topbar a {
      color: var(--ink);
      text-decoration: none;
      opacity: 0.74;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(260px, 0.8fr);
      gap: 28px;
      align-items: end;
      margin-bottom: 28px;
    }

    .eyebrow {
      margin: 0 0 12px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-size: 0.8rem;
      color: rgba(23, 49, 59, 0.66);
    }

    .hero h1 {
      margin: 0;
      font-size: clamp(2.7rem, 7vw, 6rem);
      line-height: 0.92;
      letter-spacing: -0.04em;
      max-width: 11ch;
    }

    .hero p {
      margin: 18px 0 0;
      max-width: 60ch;
      font-size: 1.06rem;
      line-height: 1.6;
      color: rgba(23, 49, 59, 0.82);
    }

    .hero-note {
      padding: 20px 22px;
      border-radius: 24px;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.62);
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
    }

    .hero-note strong {
      display: block;
      margin-bottom: 8px;
      font-size: 0.96rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .hero-note p {
      margin: 0;
      font-size: 0.98rem;
    }

    .choices {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 24px;
    }

    .card {
      position: relative;
      overflow: hidden;
      min-height: 360px;
      padding: 28px;
      border: 1px solid var(--line);
      border-radius: 24px;
      background: var(--panel);
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
      display: grid;
      gap: 20px;
      align-content: start;
    }

    .card::before {
      content: "";
      position: absolute;
      inset: auto -20% -30% auto;
      width: 220px;
      height: 220px;
      border-radius: 50%;
      opacity: 0.22;
      filter: blur(12px);
    }

    .card h2 {
      margin: 0;
      font-size: clamp(1.8rem, 4vw, 2.8rem);
      letter-spacing: -0.03em;
    }

    .card p {
      margin: 0;
      line-height: 1.65;
      max-width: 44ch;
      color: rgba(23, 49, 59, 0.82);
    }

    .tag {
      display: inline-flex;
      width: fit-content;
      padding: 7px 12px;
      border-radius: 999px;
      background: rgba(23, 49, 59, 0.08);
      font-size: 0.8rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .swatch-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .swatch {
      width: 28px;
      height: 28px;
      border-radius: 999px;
      border: 2px solid rgba(255, 255, 255, 0.7);
      box-shadow: 0 8px 20px rgba(23, 49, 59, 0.12);
    }

    .actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: auto;
    }

    .button,
    .button-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      padding: 13px 18px;
      text-decoration: none;
      font-weight: 700;
      transition: transform 140ms ease, opacity 140ms ease;
    }

    .button:hover,
    .button-secondary:hover {
      transform: translateY(-1px);
    }

    .button {
      background: linear-gradient(135deg, var(--accent) 0%, #d18047 100%);
      color: white;
    }

    .button-secondary {
      background: rgba(23, 49, 59, 0.08);
      color: var(--ink);
    }

    .einstein::before {
      background: radial-gradient(circle, rgba(180, 85, 45, 0.95) 0%, rgba(180, 85, 45, 0) 70%);
    }

    .spectre::before {
      background: radial-gradient(circle, rgba(31, 106, 93, 0.95) 0%, rgba(31, 106, 93, 0) 70%);
    }

    .footnote {
      margin-top: 26px;
      color: rgba(23, 49, 59, 0.7);
      line-height: 1.6;
      font-size: 0.95rem;
    }

    footer {
      margin-top: 40px;
      padding-top: 18px;
      border-top: 1px solid rgba(23, 49, 59, 0.12);
      display: flex;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
      color: rgba(23, 49, 59, 0.72);
      font-size: 0.95rem;
    }

    footer nav {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
    }

    footer a {
      color: var(--ink);
      text-decoration: none;
    }

    @media (max-width: 900px) {
      .hero,
      .choices {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main>
    <div class="topbar">
      <div class="brand">Aperiodos</div>
      <a href="/api">API</a>
    </div>

    <section class="hero">
      <div>
        <p class="eyebrow">Aperiodic playground</p>
        <h1>Choose a generator.</h1>
        <p>
          Start with the classic Einstein image renderer or switch to Spectre, the chiral
          monotile that does not need mirror flips. This front page gives us room to grow the site
          into a small gallery of tiling experiments instead of a single tool.
        </p>
      </div>
      <aside class="hero-note">
        <strong>Current build</strong>
        <p>
          Einstein is live today. Spectre has a dedicated page already and can serve a wasm build
          once we adapt the Rust app for deployment.
        </p>
      </aside>
    </section>

    <section class="choices">
      <article class="card einstein">
        <span class="tag">Python renderer</span>
        <h2>Einstein</h2>
        <p>
          The current image generator from this project. Tune iterations, palette, seed crops, and
          export a finished still image directly from the browser.
        </p>
        <div class="swatch-row" aria-hidden="true">
          <span class="swatch" style="background: black;"></span>
          <span class="swatch" style="background: seagreen;"></span>
          <span class="swatch" style="background: white;"></span>
          <span class="swatch" style="background: sandybrown;"></span>
          <span class="swatch" style="background: gold;"></span>
        </div>
        <div class="actions">
          <a class="button" href="/einstein">Open Einstein Generator</a>
          <a class="button-secondary" href="/api">Browse API</a>
        </div>
      </article>

      <article class="card spectre">
        <span class="tag">Rust + wasm target</span>
        <h2>Spectre</h2>
        <p>
          A chiral aperiodic monotile with a stronger interactive feel. We already have the Rust
          code cloned locally, and this route is ready for the adapted browser build.
        </p>
        <div class="actions">
          <a class="button" href="/spectre">Open Spectre Space</a>
          <a class="button-secondary" href="https://github.com/necocen/spectre">Upstream repo</a>
        </div>
      </article>
    </section>

    <p class="footnote">
      Spectre integration is staged intentionally: first the site architecture and navigation,
      then the Rust-to-web packaging, then any controls or export features we want to add on top.
    </p>

    <footer>
      <div>Aperiodos, experiments in aperiodic tilings.</div>
      <nav>
        <a href="/about">About</a>
        <a href="/einstein">Einstein</a>
        <a href="/spectre">Spectre</a>
        <a href="/api">API</a>
      </nav>
    </footer>
  </main>
</body>
</html>
"""

EINSTEIN_HTML = """
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Einstein Generator</title>
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

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 24px;
      font-size: 0.95rem;
    }

    .topbar a {
      color: var(--ink);
      text-decoration: none;
      opacity: 0.78;
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

    footer {
      margin-top: 34px;
      padding-top: 18px;
      border-top: 1px solid rgba(23, 49, 59, 0.12);
      display: flex;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
      color: rgba(23, 49, 59, 0.72);
      font-size: 0.95rem;
    }

    footer nav {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
    }

    footer a {
      color: var(--ink);
      text-decoration: none;
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
    <div class="topbar">
      <a href="/">All generators</a>
      <a href="/spectre">Spectre</a>
    </div>

    <section class="hero">
      <h1 class="title">Einstein Generator</h1>
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

    <footer>
      <div>Aperiodos, experiments in aperiodic tilings.</div>
      <nav>
        <a href="/about">About</a>
        <a href="/">Home</a>
        <a href="/spectre">Spectre</a>
        <a href="/api">API</a>
      </nav>
    </footer>
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

SPECTRE_HTML = """
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Spectre Space</title>
  <style>
    :root {
      --bg: #edf4ef;
      --panel: rgba(247, 252, 248, 0.92);
      --ink: #17313b;
      --accent: #1f6a5d;
      --accent-soft: rgba(31, 106, 93, 0.1);
      --line: rgba(23, 49, 59, 0.14);
      --shadow: 0 18px 45px rgba(23, 49, 59, 0.14);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(31, 106, 93, 0.2), transparent 28%),
        radial-gradient(circle at top right, rgba(23, 49, 59, 0.14), transparent 24%),
        linear-gradient(180deg, #f9fdf9 0%, var(--bg) 100%);
      min-height: 100vh;
    }

    main {
      width: min(1160px, calc(100% - 32px));
      margin: 0 auto;
      padding: 36px 0 56px;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 24px;
      font-size: 0.95rem;
    }

    .topbar a {
      color: var(--ink);
      text-decoration: none;
      opacity: 0.78;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
      gap: 24px;
      margin-bottom: 24px;
    }

    .hero h1 {
      margin: 0;
      font-size: clamp(2.7rem, 7vw, 5.5rem);
      line-height: 0.92;
      letter-spacing: -0.04em;
      max-width: 9ch;
    }

    .hero p {
      margin: 18px 0 0;
      max-width: 58ch;
      font-size: 1.05rem;
      line-height: 1.65;
      color: rgba(23, 49, 59, 0.82);
    }

    .note,
    .canvas-shell {
      border: 1px solid var(--line);
      border-radius: 24px;
      background: var(--panel);
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
    }

    .note {
      padding: 22px;
    }

    .note h2,
    .canvas-shell h2 {
      margin: 0 0 14px;
      font-size: 1rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .note p,
    .note li {
      line-height: 1.65;
      color: rgba(23, 49, 59, 0.82);
    }

    .canvas-shell {
      overflow: hidden;
    }

    .canvas-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 22px 22px 0;
      flex-wrap: wrap;
    }

    .badge {
      display: inline-flex;
      width: fit-content;
      padding: 8px 12px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 0.82rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 700;
    }

    .canvas-placeholder {
      min-height: 460px;
      padding: 24px;
      display: grid;
      place-items: center;
      background:
        linear-gradient(135deg, rgba(31, 106, 93, 0.06), transparent 35%),
        linear-gradient(315deg, rgba(23, 49, 59, 0.05), transparent 28%);
    }

    .canvas-card {
      width: min(100%, 620px);
      padding: 28px;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.84);
      border: 1px solid rgba(23, 49, 59, 0.1);
      text-align: left;
    }

    .canvas-card p {
      margin: 0 0 14px;
      line-height: 1.65;
    }

    .actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 18px;
    }

    .button,
    .button-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      padding: 13px 18px;
      text-decoration: none;
      font-weight: 700;
      transition: transform 140ms ease, opacity 140ms ease;
    }

    .button:hover,
    .button-secondary:hover {
      transform: translateY(-1px);
    }

    .button {
      background: linear-gradient(135deg, var(--accent) 0%, #4e8f7f 100%);
      color: white;
    }

    .button-secondary {
      background: rgba(23, 49, 59, 0.08);
      color: var(--ink);
    }

    ul {
      padding-left: 18px;
      margin: 0;
    }

    footer {
      margin-top: 34px;
      padding-top: 18px;
      border-top: 1px solid rgba(23, 49, 59, 0.12);
      display: flex;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
      color: rgba(23, 49, 59, 0.72);
      font-size: 0.95rem;
    }

    footer nav {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
    }

    footer a {
      color: var(--ink);
      text-decoration: none;
    }

    @media (max-width: 900px) {
      .hero {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main>
    <div class="topbar">
      <a href="/">All generators</a>
      <a href="/einstein">Einstein</a>
    </div>

    <section class="hero">
      <div>
        <h1>Spectre Space</h1>
        <p>
          This is the new home for the Rust-powered Spectre experience. The upstream code already
          targets wasm, so the main remaining work is packaging and adapting it for this site.
        </p>
      </div>
      <aside class="note">
        <h2>Plan</h2>
        <ul>
          <li>Keep the landing page stable while we experiment with Rust integration.</li>
          <li>Use the local <code>spectre/</code> clone as the adaptation source.</li>
          <li>Serve a browser build here once we generate the <code>pkg/</code> artifacts.</li>
        </ul>
      </aside>
    </section>

    <section class="canvas-shell">
      <div class="canvas-header">
        <h2>Spectre Runtime</h2>
        <span class="badge">{{ spectre_status }}</span>
      </div>
      <div class="canvas-placeholder">
        <div class="canvas-card">
          <p>
            {% if spectre_available %}
            A web build was detected. Open the runtime directly and we can start styling and wiring
            controls around it next.
            {% else %}
            No packaged wasm build was found yet, so this page is acting as the integration landing
            zone rather than pretending the feature already works.
            {% endif %}
          </p>
          <p>
            Upstream project: <code>necocen/spectre</code>, licensed under MIT. That makes it a
            comfortable fit for adaptation in this repo as long as we preserve the upstream notice.
          </p>
          <div class="actions">
            {% if spectre_available %}
            <a class="button" href="/spectre/app">Open Spectre Runtime</a>
            {% endif %}
            <a class="button-secondary" href="https://github.com/necocen/spectre">View upstream repo</a>
          </div>
        </div>
      </div>
    </section>

    <footer>
      <div>Aperiodos, experiments in aperiodic tilings.</div>
      <nav>
        <a href="/about">About</a>
        <a href="/">Home</a>
        <a href="/einstein">Einstein</a>
        <a href="/api">API</a>
      </nav>
    </footer>
  </main>
</body>
</html>
"""

ABOUT_HTML = """
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>About Aperiodos</title>
  <style>
    :root {
      --bg: #f5f1e7;
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
        linear-gradient(180deg, #fbf7ef 0%, var(--bg) 100%);
      min-height: 100vh;
    }

    main {
      width: min(960px, calc(100% - 32px));
      margin: 0 auto;
      padding: 36px 0 56px;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 24px;
      font-size: 0.95rem;
    }

    .topbar a {
      color: var(--ink);
      text-decoration: none;
      opacity: 0.78;
    }

    .hero {
      margin-bottom: 24px;
    }

    .hero h1 {
      margin: 0;
      font-size: clamp(2.5rem, 6vw, 4.8rem);
      line-height: 0.94;
      letter-spacing: -0.04em;
      max-width: 10ch;
    }

    .hero p {
      margin: 18px 0 0;
      max-width: 58ch;
      line-height: 1.65;
      color: rgba(23, 49, 59, 0.82);
      font-size: 1.04rem;
    }

    .panel {
      padding: 24px;
      border: 1px solid var(--line);
      border-radius: 24px;
      background: var(--panel);
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
      margin-bottom: 18px;
    }

    .panel h2 {
      margin: 0 0 14px;
      font-size: 1rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .panel p,
    .panel li {
      line-height: 1.7;
      color: rgba(23, 49, 59, 0.82);
    }

    ul {
      margin: 0;
      padding-left: 18px;
    }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    footer {
      margin-top: 34px;
      padding-top: 18px;
      border-top: 1px solid rgba(23, 49, 59, 0.12);
      display: flex;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
      color: rgba(23, 49, 59, 0.72);
      font-size: 0.95rem;
    }

    footer nav {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
    }

    footer a,
    .panel a {
      color: var(--ink);
    }
  </style>
</head>
<body>
  <main>
    <div class="topbar">
      <a href="/">Home</a>
      <a href="/api">API</a>
    </div>

    <section class="hero">
      <h1>About Aperiodos</h1>
      <p>
        Aperiodos is a small playground for aperiodic monotiles, image generation, and browser
        experiments. The site currently centers on the Einstein renderer and is being expanded
        toward Spectre and other tiling references.
      </p>
    </section>

    <section class="panel">
      <h2>References</h2>
      <ul>
        <li><a href="https://cs.uwaterloo.ca/~csk/hat/h7h8.html">Hat monotile reference page</a></li>
        <li><a href="https://cs.uwaterloo.ca/~csk/spectre/">Spectre project page</a></li>
        <li><a href="https://github.com/asmoly/Einstein_Tile_Generator">Earlier Einstein inspiration repo</a></li>
        <li><a href="https://github.com/necocen/spectre">necocen/spectre</a></li>
      </ul>
    </section>

    <section class="panel">
      <h2>Credits And Guidance</h2>
      <p>
        This project draws on papers, mathematical references, and public open-source experiments
        to explore how these tilings can be rendered and presented on the web. This page is a good
        place to acknowledge repos, articles, and people whose work informed the implementation.
      </p>
      <p>
        If code from another MIT project is still present in adapted form, the safest path is to
        keep the upstream license notice alongside your own project license rather than relying only
        on a README mention.
      </p>
    </section>

    <section class="panel">
      <h2>Project Notes</h2>
      <p>
        The Rust-based Spectre work is currently being adapted from the local <code>spectre/</code>
        clone into a site-friendly browser experience. The visual language is shared across the
        whole site so Einstein and Spectre feel like parts of one project.
      </p>
    </section>

    <footer>
      <div>Aperiodos, experiments in aperiodic tilings.</div>
      <nav>
        <a href="/">Home</a>
        <a href="/einstein">Einstein</a>
        <a href="/spectre">Spectre</a>
        <a href="/api">API</a>
      </nav>
    </footer>
  </main>
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


def _spectre_available():
    return SPECTRE_INDEX_PATH.exists() and SPECTRE_PKG_JS_PATH.exists()


@app.get("/")
def index():
    return render_template_string(HOME_HTML)


@app.get("/einstein")
def einstein():
    return render_template_string(EINSTEIN_HTML)


@app.get("/spectre")
def spectre():
    spectre_available = _spectre_available()
    return render_template_string(
        SPECTRE_HTML,
        spectre_available=spectre_available,
        spectre_status="wasm build ready" if spectre_available else "waiting for wasm build",
    )


@app.get("/about")
def about():
    return render_template_string(ABOUT_HTML)


@app.get("/spectre/app")
def spectre_app():
    if not SPECTRE_INDEX_PATH.exists():
        abort(404)
    if not _spectre_available():
        return (
            jsonify(
                {
                    "error": "Spectre wasm build not found yet.",
                    "hint": "Run wasm-pack build --target web --release inside the spectre directory first.",
                }
            ),
            404,
        )
    return send_from_directory(SPECTRE_DIR, "index.html")


@app.get("/spectre/pkg/<path:filename>")
def spectre_pkg(filename):
    if not _spectre_available():
        abort(404)
    return send_from_directory(SPECTRE_PKG_DIR, filename)


@app.get("/api")
def api_index():
    return jsonify(
        {
            "service": "aperiodic-monotiles-generator",
            "status": "ok",
            "endpoints": {
                "GET /": "Generator chooser UI",
                "GET /about": "About page with references and acknowledgements",
                "GET /einstein": "Interactive Einstein generator",
                "GET /spectre": "Spectre integration landing page",
                "GET /spectre/app": "Serve the packaged Spectre wasm app when available",
                "GET /api": "API overview",
                "GET /healthz": "Basic health check",
                "POST /render": "Generate an Einstein image and return it directly",
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
