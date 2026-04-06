import { NavLink, Route, Routes } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

const CSS_COLOR_OPTIONS = [
  "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige", "bisque", "black",
  "blanchedalmond", "blue", "blueviolet", "brown", "burlywood", "cadetblue", "chartreuse",
  "chocolate", "coral", "cornflowerblue", "cornsilk", "crimson", "cyan", "darkblue", "darkcyan",
  "darkgoldenrod", "darkgray", "darkgreen", "darkgrey", "darkkhaki", "darkmagenta",
  "darkolivegreen", "darkorange", "darkorchid", "darkred", "darksalmon", "darkseagreen",
  "darkslateblue", "darkslategray", "darkslategrey", "darkturquoise", "darkviolet", "deeppink",
  "deepskyblue", "dimgray", "dimgrey", "dodgerblue", "firebrick", "floralwhite", "forestgreen",
  "fuchsia", "gainsboro", "ghostwhite", "gold", "goldenrod", "gray", "green", "greenyellow",
  "grey", "honeydew", "hotpink", "indianred", "indigo", "ivory", "khaki", "lavender",
  "lavenderblush", "lawngreen", "lemonchiffon", "lightblue", "lightcoral", "lightcyan",
  "lightgoldenrodyellow", "lightgray", "lightgreen", "lightgrey", "lightpink", "lightsalmon",
  "lightseagreen", "lightskyblue", "lightslategray", "lightslategrey", "lightsteelblue",
  "lightyellow", "lime", "limegreen", "linen", "magenta", "maroon", "mediumaquamarine",
  "mediumblue", "mediumorchid", "mediumpurple", "mediumseagreen", "mediumslateblue",
  "mediumspringgreen", "mediumturquoise", "mediumvioletred", "midnightblue", "mintcream",
  "mistyrose", "moccasin", "navajowhite", "navy", "oldlace", "olive", "olivedrab", "orange",
  "orangered", "orchid", "palegoldenrod", "palegreen", "paleturquoise", "palevioletred",
  "papayawhip", "peachpuff", "peru", "pink", "plum", "powderblue", "purple", "rebeccapurple",
  "red", "rosybrown", "royalblue", "saddlebrown", "salmon", "sandybrown", "seagreen",
  "seashell", "sienna", "silver", "skyblue", "slateblue", "slategray", "slategrey", "snow",
  "springgreen", "steelblue", "tan", "teal", "thistle", "tomato", "transparent", "turquoise",
  "violet", "wheat", "white", "whitesmoke", "yellow", "yellowgreen"
];

const ABOUT_FALLBACK = {
  title: "About Aperiodos",
  summary:
    "Aperiodos is a Trainvent subservice for aperiodic monotiles, image generation, and browser experiments.",
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
  color_mode: "families",
  seed: "",
  color_h1: "black",
  color_h: "seagreen",
  color_t: "white",
  color_p: "sandybrown",
  color_f: "gold",
  four_color_1: "seagreen",
  four_color_2: "sienna",
  four_color_3: "goldenrod",
  four_color_4: "midnightblue",
  no_outline: false
};

const SPECTRE_DEFAULTS = {
  width: 900,
  height: 900,
  level: 5,
  scale: 4,
  center_x: 0,
  center_y: 0,
  format: "svg",
  draw_mode: "translation",
  background: "linen",
  outline: "black",
  stroke_width: 1,
  palette_1: "seagreen",
  palette_2: "sienna",
  palette_3: "goldenrod",
  palette_4: "midnightblue"
};

const PENROSE_DEFAULTS = {
  width: 1200,
  height: 1200,
  iterations: 7,
  scale: 320,
  center_x: 0,
  center_y: 0,
  format: "svg",
  seed: "sun",
  color_mode: "tile_type",
  background: "linen",
  outline: "black",
  stroke_width: 1.1,
  palette_1: "#204f7a",
  palette_2: "#d18c45",
  palette_3: "#eadfc8",
  palette_4: "#7e2f39"
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export default function App() {
  return (
    <div className="shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <header className="topbar">
        <NavLink className="brand" to="/">
          <img className="brand-mark" src="/custom-pattern_1024.png" alt="" />
          <span className="brand-copy">Aperiodos</span>
        </NavLink>
        <nav className="topnav">
          <TopNavLink to="/">Home</TopNavLink>
          <TopNavLink to="/einstein">Einstein</TopNavLink>
          <TopNavLink to="/spectre">Spectre</TopNavLink>
          <TopNavLink to="/penrose">Penrose</TopNavLink>
          <TopNavLink to="/about">About</TopNavLink>
        </nav>
      </header>

      <main className="page">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/einstein" element={<EinsteinPage />} />
          <Route path="/spectre" element={<SpectrePage />} />
          <Route path="/penrose" element={<PenrosePage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>

      <footer className="footer">
        <div>
          Aperiodos is a Trainvent subservice for experiments in aperiodic tilings.{" "}
          <a href="https://www.trainvent.com/" target="_blank" rel="noreferrer">
            Trainvent
          </a>
        </div>
        <nav className="footer-nav">
          <TopNavLink to="/about">About</TopNavLink>
          <TopNavLink to="/einstein">Einstein</TopNavLink>
          <TopNavLink to="/spectre">Spectre</TopNavLink>
          <TopNavLink to="/penrose">Penrose</TopNavLink>
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
          <p className="eyebrow">Trainvent subservice</p>
          <h1>Choose a generator.</h1>
          <p className="lede">
            Start with the classic Einstein image renderer or switch
            to Spectre, or explore a first Penrose kite-and-dart renderer built in Rust.
          </p>
        </div>
        <aside className="hero-note panel">
          <strong>Current build</strong>
          <p>Einstein renders PNG/JPG. Spectre and Penrose both render from Rust backends with SVG-first export.</p>
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
            Render bounded Spectre snapshots with a pattern variant, palette, framing, and stroke
            controls, then download the SVG directly.
          </p>
          <NavLink className="button button-green" to="/spectre">
            Open Spectre Generator
          </NavLink>
        </article>

        <article className="feature-card feature-penrose panel">
          <span className="tag">Rust renderer</span>
          <h2>Penrose</h2>
          <p>
            Build kite-and-dart tilings from a classic sun or star seed, tune the viewport, and
            export the result as SVG or PNG.
          </p>
          <NavLink className="button button-ink" to="/penrose">
            Open Penrose Generator
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
            name="color_mode"
            label="Coloring"
            options={[
              { value: "families", label: "Tile Families" },
              { value: "four_color", label: "Four-Color" }
            ]}
            full
          />
          <SelectField
            values={values}
            setValues={setValues}
            name="format"
            label="Format"
            options={[
              { value: "png", label: "PNG" },
              { value: "jpg", label: "JPG" },
              { value: "svg", label: "SVG" }
            ]}
            full
          />
          <TextField values={values} setValues={setValues} name="seed" label="Seed" placeholder="Optional" full />
          {values.color_mode === "families" ? (
            <div className="swatches full">
              <ColorField values={values} setValues={setValues} name="color_h1" label="H1" />
              <ColorField values={values} setValues={setValues} name="color_h" label="H" />
              <ColorField values={values} setValues={setValues} name="color_t" label="T" />
              <ColorField values={values} setValues={setValues} name="color_p" label="P" />
              <ColorField values={values} setValues={setValues} name="color_f" label="F" full />
            </div>
          ) : (
            <div className="swatches full">
              <ColorField values={values} setValues={setValues} name="four_color_1" label="Color 1" />
              <ColorField values={values} setValues={setValues} name="four_color_2" label="Color 2" />
              <ColorField values={values} setValues={setValues} name="four_color_3" label="Color 3" />
              <ColorField values={values} setValues={setValues} name="four_color_4" label="Color 4" />
            </div>
          )}
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
          color_mode: values.color_mode,
          colors: [values.color_h1, values.color_h, values.color_t, values.color_p, values.color_f],
          four_colors: [values.four_color_1, values.four_color_2, values.four_color_3, values.four_color_4],
          no_outline: Boolean(values.no_outline)
        };
        if (String(values.seed).trim()) {
          payload.seed = Number(values.seed);
        }
        return payload;
      }}
      endpoint={apiUrl("/api/einstein/render")}
      downloadName={(payload) => `aperiodic-pattern.${payload.format}`}
      previewType={(payload) => {
        if (payload.format === "jpg") {
          return "image/jpeg";
        }
        if (payload.format === "svg") {
          return "image/svg+xml";
        }
        return "image/png";
      }}
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
      description="Render bounded Spectre snapshots from the Rust engine, choose a pattern variant, tune the palette and framing, and export SVG."
      controls={
        <>
          <NumberField values={values} setValues={setValues} name="width" label="Width" min={64} max={6000} />
          <NumberField values={values} setValues={setValues} name="height" label="Height" min={64} max={6000} />
          <NumberField values={values} setValues={setValues} name="level" label="Seed" min={1} max={8} />
          <NumberField values={values} setValues={setValues} name="scale" label="Scale" min={1} max={120} />
          <NumberField values={values} setValues={setValues} name="center_x" label="Center X" step="0.1" />
          <NumberField values={values} setValues={setValues} name="center_y" label="Center Y" step="0.1" />
          <SelectField
            values={values}
            setValues={setValues}
            name="format"
            label="Format"
            options={[
              { value: "svg", label: "SVG" },
              { value: "png", label: "PNG" }
            ]}
            full
          />
          <SelectField
            values={values}
            setValues={setValues}
            name="draw_mode"
            label="Drawing Logic"
            options={[
              { value: "generated", label: "Build" },
              { value: "translation", label: "Translation" }
            ]}
            full
          />
          <ColorField values={values} setValues={setValues} name="background" label="Background" full />
          <ColorField values={values} setValues={setValues} name="outline" label="Outline" full />
          <NumberField values={values} setValues={setValues} name="stroke_width" label="Stroke Width" min={0} max={20} step="0.1" />
          <div className="swatches full">
            <ColorField values={values} setValues={setValues} name="palette_1" label="Color 1" />
            <ColorField values={values} setValues={setValues} name="palette_2" label="Color 2" />
            <ColorField values={values} setValues={setValues} name="palette_3" label="Color 3" />
            <ColorField values={values} setValues={setValues} name="palette_4" label="Color 4" />
          </div>
        </>
      }
      payload={() => ({
        width: Number(values.width),
        height: Number(values.height),
        level: Number(values.level),
        scale: Number(values.scale),
        center_x: Number(values.center_x),
        center_y: Number(values.center_y),
        format: values.format,
        draw_mode: values.draw_mode,
        background: values.background,
        outline: values.outline,
        stroke_width: Number(values.stroke_width),
        palette: [values.palette_1, values.palette_2, values.palette_3, values.palette_4]
          .map((value) => String(value).trim())
          .filter(Boolean)
      })}
      endpoint={apiUrl("/api/spectre/render")}
      downloadName={(payload) => `spectre.${payload.format}`}
      previewType={(payload) => (payload.format === "png" ? "image/png" : "image/svg+xml")}
      values={values}
      setValues={setValues}
      defaults={SPECTRE_DEFAULTS}
    />
  );
}

function PenrosePage() {
  const [values, setValues] = useState(PENROSE_DEFAULTS);
  return (
    <GeneratorLayout
      title="Penrose Generator"
      description="Generate Penrose P2 kite-and-dart tilings from a sun or star seed, then adjust the framing, coloring, and export format."
      controls={
        <>
          <NumberField values={values} setValues={setValues} name="width" label="Width" min={64} max={6000} />
          <NumberField values={values} setValues={setValues} name="height" label="Height" min={64} max={6000} />
          <NumberField values={values} setValues={setValues} name="iterations" label="Iterations" min={0} max={10} />
          <NumberField values={values} setValues={setValues} name="scale" label="Scale" min={10} max={1200} />
          <NumberField values={values} setValues={setValues} name="center_x" label="Center X" step="0.01" />
          <NumberField values={values} setValues={setValues} name="center_y" label="Center Y" step="0.01" />
          <SelectField
            values={values}
            setValues={setValues}
            name="seed"
            label="Seed"
            options={[
              { value: "sun", label: "Sun" },
              { value: "star", label: "Star" }
            ]}
          />
          <SelectField
            values={values}
            setValues={setValues}
            name="color_mode"
            label="Coloring"
            options={[
              { value: "tile_type", label: "Tile Type" },
              { value: "orientation", label: "Orientation" }
            ]}
          />
          <SelectField
            values={values}
            setValues={setValues}
            name="format"
            label="Format"
            options={[
              { value: "svg", label: "SVG" },
              { value: "png", label: "PNG" }
            ]}
            full
          />
          <ColorField values={values} setValues={setValues} name="background" label="Background" full />
          <ColorField values={values} setValues={setValues} name="outline" label="Outline" full />
          <NumberField values={values} setValues={setValues} name="stroke_width" label="Stroke Width" min={0} max={20} step="0.1" />
          <div className="swatches full">
            <ColorField values={values} setValues={setValues} name="palette_1" label="Color 1" />
            <ColorField values={values} setValues={setValues} name="palette_2" label="Color 2" />
            <ColorField values={values} setValues={setValues} name="palette_3" label="Color 3" />
            <ColorField values={values} setValues={setValues} name="palette_4" label="Color 4" />
          </div>
        </>
      }
      payload={() => ({
        width: Number(values.width),
        height: Number(values.height),
        iterations: Number(values.iterations),
        scale: Number(values.scale),
        center_x: Number(values.center_x),
        center_y: Number(values.center_y),
        format: values.format,
        seed: values.seed,
        color_mode: values.color_mode,
        background: values.background,
        outline: values.outline,
        stroke_width: Number(values.stroke_width),
        palette: [values.palette_1, values.palette_2, values.palette_3, values.palette_4]
          .map((value) => String(value).trim())
          .filter(Boolean)
      })}
      endpoint={apiUrl("/api/penrose/render")}
      downloadName={(payload) => `penrose.${payload.format}`}
      previewType={(payload) => (payload.format === "png" ? "image/png" : "image/svg+xml")}
      values={values}
      setValues={setValues}
      defaults={PENROSE_DEFAULTS}
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
    fetch(apiUrl("/api/about"))
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

function ColorField({ values, setValues, name, label, placeholder = "Type or search a CSS color", full = false }) {
  const listId = `color-options-${name}`;
  return (
    <label className={full ? "full color-field" : "color-field"}>
      <span>{label}</span>
      <div className="color-input-wrap">
        <span className="color-chip" style={{ background: values[name] || "transparent" }} aria-hidden="true" />
        <input
          name={name}
          type="text"
          list={listId}
          placeholder={placeholder}
          value={values[name]}
          onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
        />
        <datalist id={listId}>
          {CSS_COLOR_OPTIONS.map((color) => (
            <option key={color} value={color} />
          ))}
        </datalist>
      </div>
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
