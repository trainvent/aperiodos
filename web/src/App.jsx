import { NavLink, Route, Routes } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

const ABOUT_FALLBACK = {
  title: "About Aperiodos",
  summary:
    "Aperiodos is a small playground for aperiodic monotiles, image generation, and browser experiments.",
  references: [],
  credits: "",
  technical_realizations: "",
  notes: ""
};

const EINSTEIN_DEFAULTS = {
  iterations: 5,
  scalar: 20,
  width: 1600,
  height: 1600,
  format: "png",
  seed: "",
  color_h1: "black",
  color_h: "seagreen",
  color_t: "white",
  color_p: "sandybrown",
  color_f: "gold",
  no_outline: false
};

const SPECTRE_DEFAULTS = {
  width: 1600,
  height: 1600,
  level: 5,
  scale: 40,
  center_x: 0,
  center_y: 0,
  background: "#f5f1e7",
  outline: "#17313b",
  stroke_width: 1.2,
  palette: "#17313b,#1f6a5d,#b4552d,#d8b24c,#f6f1e8"
};

export default function App() {
  return (
    <div className="shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <header className="topbar">
        <NavLink className="brand" to="/">
          Aperiodos
        </NavLink>
        <nav className="topnav">
          <TopNavLink to="/">Home</TopNavLink>
          <TopNavLink to="/einstein">Einstein</TopNavLink>
          <TopNavLink to="/spectre">Spectre</TopNavLink>
          <TopNavLink to="/about">About</TopNavLink>
        </nav>
      </header>

      <main className="page">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/einstein" element={<EinsteinPage />} />
          <Route path="/spectre" element={<SpectrePage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>

      <footer className="footer">
        <div>Aperiodos, experiments in aperiodic tilings.</div>
        <nav className="footer-nav">
          <TopNavLink to="/about">About</TopNavLink>
          <TopNavLink to="/einstein">Einstein</TopNavLink>
          <TopNavLink to="/spectre">Spectre</TopNavLink>
        </nav>
      </footer>
    </div>
  );
}

function TopNavLink({ to, children }) {
  return (
    <NavLink className={({ isActive }) => `navlink${isActive ? " active" : ""}`} to={to}>
      {children}
    </NavLink>
  );
}

function HomePage() {
  return (
    <>
      <section className="hero hero-grid">
        <div>
          <p className="eyebrow">Aperiodic playground</p>
          <h1>Choose a generator.</h1>
          <p className="lede">
            Start with the classic Einstein image renderer or switch to Spectre, the chiral monotile
            that does not need mirror flips. One interface, two render engines, and room to grow.
          </p>
        </div>
        <aside className="hero-note panel">
          <strong>Current build</strong>
          <p>Einstein renders PNG/JPG today. Spectre v1 renders SVG through the new Rust backend.</p>
        </aside>
      </section>

      <section className="card-grid">
        <article className="feature-card feature-einstein panel">
          <span className="tag">Python renderer</span>
          <h2>Einstein</h2>
          <p>Fine-tune iterations, palette, image size, and seed crops, then export a finished still image.</p>
          <div className="swatch-row" aria-hidden="true">
            {["black", "seagreen", "white", "sandybrown", "gold"].map((color) => (
              <span className="swatch" key={color} style={{ background: color }} />
            ))}
          </div>
          <NavLink className="button" to="/einstein">
            Open Einstein Generator
          </NavLink>
        </article>

        <article className="feature-card feature-spectre panel">
          <span className="tag">Rust renderer</span>
          <h2>Spectre</h2>
          <p>
            Render bounded Spectre snapshots with palette, scale, center, and stroke controls, then
            download the SVG directly.
          </p>
          <NavLink className="button button-green" to="/spectre">
            Open Spectre Generator
          </NavLink>
        </article>
      </section>
    </>
  );
}

function EinsteinPage() {
  const [values, setValues] = useState(EINSTEIN_DEFAULTS);
  return (
    <GeneratorLayout
      title="Einstein Generator"
      description="Adjust scale, size, and palette, then render a new image in the format you like."
      controls={
        <>
          <NumberField values={values} setValues={setValues} name="iterations" label="Iterations" min={1} max={6} />
          <NumberField values={values} setValues={setValues} name="scalar" label="Scalar" min={1} max={80} />
          <NumberField values={values} setValues={setValues} name="width" label="Width" min={64} max={6000} />
          <NumberField values={values} setValues={setValues} name="height" label="Height" min={64} max={6000} />
          <SelectField
            values={values}
            setValues={setValues}
            name="format"
            label="Format"
            options={[
              { value: "png", label: "PNG" },
              { value: "jpg", label: "JPG" }
            ]}
            full
          />
          <TextField values={values} setValues={setValues} name="seed" label="Seed" placeholder="Optional" full />
          <div className="swatches full">
            <TextField values={values} setValues={setValues} name="color_h1" label="H1" />
            <TextField values={values} setValues={setValues} name="color_h" label="H" />
            <TextField values={values} setValues={setValues} name="color_t" label="T" />
            <TextField values={values} setValues={setValues} name="color_p" label="P" />
            <TextField values={values} setValues={setValues} name="color_f" label="F" full />
          </div>
          <CheckboxField
            values={values}
            setValues={setValues}
            name="no_outline"
            label="Render without black outlines"
          />
        </>
      }
      payload={() => {
        const payload = {
          iterations: Number(values.iterations),
          scalar: Number(values.scalar),
          width: Number(values.width),
          height: Number(values.height),
          format: values.format,
          colors: [values.color_h1, values.color_h, values.color_t, values.color_p, values.color_f],
          no_outline: Boolean(values.no_outline)
        };
        if (String(values.seed).trim()) {
          payload.seed = Number(values.seed);
        }
        return payload;
      }}
      endpoint="/api/einstein/render"
      downloadName={(payload) => `aperiodic-pattern.${payload.format}`}
      previewType={(payload) => (payload.format === "jpg" ? "image/jpeg" : "image/png")}
      values={values}
      setValues={setValues}
      defaults={EINSTEIN_DEFAULTS}
    />
  );
}

function SpectrePage() {
  const [values, setValues] = useState(SPECTRE_DEFAULTS);
  return (
    <GeneratorLayout
      title="Spectre Generator"
      description="Render bounded Spectre snapshots from the Rust engine, adjust the viewport, and export SVG."
      controls={
        <>
          <NumberField values={values} setValues={setValues} name="width" label="Width" min={64} max={6000} />
          <NumberField values={values} setValues={setValues} name="height" label="Height" min={64} max={6000} />
          <NumberField values={values} setValues={setValues} name="level" label="Level" min={1} max={8} />
          <NumberField values={values} setValues={setValues} name="scale" label="Scale" min={1} max={120} />
          <NumberField values={values} setValues={setValues} name="center_x" label="Center X" step="0.1" />
          <NumberField values={values} setValues={setValues} name="center_y" label="Center Y" step="0.1" />
          <TextField values={values} setValues={setValues} name="background" label="Background" full />
          <TextField values={values} setValues={setValues} name="outline" label="Outline" full />
          <NumberField values={values} setValues={setValues} name="stroke_width" label="Stroke Width" min={0} max={20} step="0.1" />
          <TextField
            values={values}
            setValues={setValues}
            name="palette"
            label="Palette"
            placeholder="#17313b,#1f6a5d,#b4552d,#d8b24c,#f6f1e8"
            full
          />
        </>
      }
      payload={() => ({
        width: Number(values.width),
        height: Number(values.height),
        level: Number(values.level),
        scale: Number(values.scale),
        center_x: Number(values.center_x),
        center_y: Number(values.center_y),
        background: values.background,
        outline: values.outline,
        stroke_width: Number(values.stroke_width),
        palette: String(values.palette)
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      })}
      endpoint="/api/spectre/render"
      downloadName={() => "spectre.svg"}
      previewType={() => "image/svg+xml"}
      values={values}
      setValues={setValues}
      defaults={SPECTRE_DEFAULTS}
    />
  );
}

function GeneratorLayout({
  title,
  description,
  controls,
  payload,
  endpoint,
  downloadName,
  previewType,
  values,
  setValues,
  defaults
}) {
  const [status, setStatus] = useState("Ready to render.");
  const [previewUrl, setPreviewUrl] = useState("");
  const lastUrlRef = useRef("");

  useEffect(() => {
    return () => {
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
      }
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const requestPayload = payload();
    setStatus("Rendering...");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Render failed.");
      }

      const blob = await response.blob();
      const typedBlob = new Blob([blob], { type: previewType(requestPayload) });
      const nextUrl = URL.createObjectURL(typedBlob);
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
      }
      lastUrlRef.current = nextUrl;
      setPreviewUrl(nextUrl);
      setStatus("Render complete.");
    } catch (error) {
      setStatus(error.message || "Render failed.");
    }
  }

  function reset() {
    setValues(defaults);
    setStatus("Settings reset.");
  }

  return (
    <>
      <section className="hero">
        <h1>{title}</h1>
        <p className="lede">{description}</p>
      </section>

      <section className="generator-layout">
        <form className="panel controls-panel" onSubmit={handleSubmit}>
          <h2>Settings</h2>
          <div className="grid">{controls}</div>
          <div className="actions-row">
            <button className="button" type="submit">
              Generate
            </button>
            <button className="button button-muted" type="button" onClick={reset}>
              Reset
            </button>
          </div>
        </form>

        <section className="panel preview-panel">
          <h2>Preview</h2>
          <div className="meta">
            <div className="status">{status}</div>
            {previewUrl ? (
              <a className="button button-green small" href={previewUrl} download={downloadName(payload())}>
                Download
              </a>
            ) : null}
          </div>
          <div className="preview-box">
            {previewUrl ? (
              previewType(payload()) === "image/svg+xml" ? (
                <object className="preview-object" data={previewUrl} type="image/svg+xml" aria-label={`${title} preview`} />
              ) : (
                <img className="preview-image" src={previewUrl} alt={`${title} preview`} />
              )
            ) : (
              <div className="placeholder">
                Your generated artwork will appear here. Start with the default settings or explore a new palette.
              </div>
            )}
          </div>
        </section>
      </section>
    </>
  );
}

function AboutPage() {
  const [content, setContent] = useState(ABOUT_FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/about")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setContent(data);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <section className="hero">
        <h1>{content.title}</h1>
        <p className="lede">{content.summary}</p>
      </section>

      <section className="stack">
        <article className="panel prose-panel">
          <h2>References</h2>
          <ul className="reference-list">
            {content.references.map((reference) => (
              <li key={reference.url}>
                <a href={reference.url}>{reference.label}</a>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel prose-panel">
          <h2>Credits And Guidance</h2>
          <p>{content.credits}</p>
        </article>

        <article className="panel prose-panel">
          <h2>Technical Realizations</h2>
          <p>{content.technical_realizations}</p>
        </article>

        <article className="panel prose-panel">
          <h2>Project Notes</h2>
          <p>{content.notes}</p>
        </article>
      </section>
    </>
  );
}

function NumberField({ values, setValues, name, label, min, max, step, full = false }) {
  return (
    <label className={full ? "full" : ""}>
      <span>{label}</span>
      <input
        name={name}
        type="number"
        min={min}
        max={max}
        step={step}
        value={values[name]}
        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
      />
    </label>
  );
}

function TextField({ values, setValues, name, label, placeholder, full = false }) {
  return (
    <label className={full ? "full" : ""}>
      <span>{label}</span>
      <input
        name={name}
        type="text"
        placeholder={placeholder}
        value={values[name]}
        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
      />
    </label>
  );
}

function SelectField({ values, setValues, name, label, options, full = false }) {
  return (
    <label className={full ? "full" : ""}>
      <span>{label}</span>
      <select
        name={name}
        value={values[name]}
        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({ values, setValues, name, label }) {
  return (
    <label className="checkbox">
      <input
        name={name}
        type="checkbox"
        checked={Boolean(values[name])}
        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.checked }))}
      />
      <span>{label}</span>
    </label>
  );
}
