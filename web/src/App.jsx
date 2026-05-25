import { NavLink, Route, Routes } from "react-router-dom";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import brandIconUrl from "./assets/custom-pattern_1024.png";

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

function createAboutFallback(t) {
  return {
    title: t("about.hero.title"),
    summary: t("about.hero.summary"),
    references: [
      {
        label: "Trainvent",
        url: "https://next.trainvent.com/"
      },
      {
        label: t("about.references.hat"),
        url: "https://cs.uwaterloo.ca/~csk/hat/h7h8.html"
      },
      {
        label: t("about.references.spectre"),
        url: "https://cs.uwaterloo.ca/~csk/spectre/"
      },
      {
        label: t("about.references.einsteinRepo"),
        url: "https://github.com/asmoly/Einstein_Tile_Generator"
      },
      {
        label: "necocen/spectre",
        url: "https://github.com/necocen/spectre"
      },
      {
        label: "OpenAI",
        url: "https://openai.com/"
      }
    ],
    credits: t("about.sections.creditsBody"),
    technical_realizations: t("about.sections.technicalBody"),
    notes: t("about.sections.notesBody")
  };
}

const EINSTEIN_DEFAULTS = {
  iterations: 5,
  scalar: 20,
  width: 1600,
  height: 1600,
  format: "png",
  color_mode: "families",
  seed: "",
  color_h1: "black",
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
  shape: "straight",
  background: "white",
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
  iterations: 4,
  scale: 320,
  center_x: 0,
  center_y: 0,
  format: "svg",
  build_logic: "default",
  tile_mode: "kite-dart",
  background: "white",
  outline: "black",
  stroke_width: 1,
  palette_1: "wheat",
  palette_2: "midnightblue",
  palette_3: "sandybrown",
  palette_4: "seagreen"
};

const DONATION_DEFAULTS = {
  amount_major: 10,
  name: "",
  message: "",
  is_public: true
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export default function App() {
  const { t, i18n } = useTranslation("common");
  const language = i18n.resolvedLanguage === "en" ? "en" : "de";

  return (
    <div className="shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <header className="topbar">
        <NavLink className="brand" to="/">
          <img className="brand-mark" src={brandIconUrl} alt="" />
          <span className="brand-copy">Aperiodos</span>
        </NavLink>
        <div className="topbar-right">
          <nav className="topnav">
            <TopNavLink to="/">{t("nav.home")}</TopNavLink>
            <TopNavLink to="/einstein">Einstein</TopNavLink>
            <TopNavLink to="/spectre">Spectre</TopNavLink>
            <TopNavLink to="/penrose">Penrose</TopNavLink>
            <TopNavLink to="/sponsors">{t("nav.sponsors")}</TopNavLink>
            <TopNavLink to="/about">{t("nav.about")}</TopNavLink>
          </nav>
          <div className="lang-switch" role="group" aria-label={t("language.label")}>
            <span className="lang-switch-control">
              <button
                className="lang-toggle"
                type="button"
                onClick={() => i18n.changeLanguage(language === "de" ? "en" : "de")}
                aria-label="Toggle language"
              >
                <span className="lang-flag" aria-hidden="true">{language === "de" ? "🇩🇪" : "🇬🇧"}</span>
                <span className="lang-code">{language.toUpperCase()}</span>
              </button>
            </span>
          </div>
        </div>
      </header>

      <main className="page">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/donate" element={<DonatePage />} />
          <Route path="/einstein" element={<EinsteinPage />} />
          <Route path="/spectre" element={<SpectrePage />} />
          <Route path="/penrose" element={<PenrosePage />} />
          <Route path="/sponsors" element={<SponsorsPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>

      <footer className="footer">
        <div>
          {t("footer.lead")}{" "}
          <a href="https://next.trainvent.com/" target="_blank" rel="noreferrer">
            Trainvent
          </a>
        </div>
        <nav className="footer-nav">
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
  const { t } = useTranslation("common");

  const monotileCards = [
    {
      title: "Einstein",
      description: t("home.cards.einsteinDescription"),
      to: "/einstein",
      className: "feature-einstein",
      buttonClassName: "button",
      arrow: true,
      arrowColor: "seagreen"
    },
    {
      title: "Spectre",
      description: t("home.cards.spectreDescription"),
      to: "/spectre",
      className: "feature-spectre",
      buttonClassName: "button button-green",
      arrow: true,
      arrowColor: "sienna"
    }
  ];

  const otherCards = [
    {
      title: "Penrose",
      description: t("home.cards.penroseDescription"),
      to: "/penrose",
      className: "feature-penrose",
      buttonClassName: "button button-ink",
      arrow: true,
      arrowColor: "red"
    }
  ];

  return (
    <>
      <section className="hero hero-grid">
        <div>
          <h1>{t("home.hero.title")}</h1>
          <p className="lede">{t("home.hero.lede")}</p>
        </div>
        <aside className="hero-note panel">
          <strong>{t("home.hero.tools")}</strong>
          <p>{t("home.hero.toolsText")}</p>
        </aside>
      </section>

      <section className="card-grid">
        <div className="card-group panel-group monotile-group">
          <article className="feature-card monotile-merged panel">
            <div className="panel-kicker"><span className="group-title">{t("home.groups.monotile")}</span></div>
            <div className="monotile-inner">
              {monotileCards.map((card) => (
                <div className="monotile-card" key={card.title}>
                  <h2>{card.title}</h2>
                  <p>{card.description}</p>
                  <div className="feature-spacer" aria-hidden="true" />
                  <NavLink
                    className={card.buttonClassName}
                    to={card.to}
                    aria-label={`${t("home.openLabel")} ${card.title}`}
                    style={card.arrowColor ? { ['--cta-color']: card.arrowColor } : undefined}
                  >
                    {card.arrow ? (
                      <span className="card-cta" aria-hidden="true">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M5 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    ) : null}
                  </NavLink>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="card-group panel-group">
          <div className="group-cards">
            {otherCards.map((card, index) => (
                <article key={card.title} className={`feature-card ${card.className} panel`}>
                {index === 0 ? <div className="panel-kicker"><span className="group-title">{t("home.groups.tileCombinations")}</span></div> : null}
                <h2>{card.title}</h2>
                <p>{card.description}</p>
                <div className="feature-spacer" aria-hidden="true" />
                <NavLink
                  className={card.buttonClassName}
                  to={card.to}
                  aria-label={`${t("home.openLabel")} ${card.title}`}
                  style={card.arrowColor ? { ['--cta-color']: card.arrowColor } : undefined}
                >
                  {card.arrow ? (
                    <span className="card-cta" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  ) : null}
                </NavLink>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function DonatePage() {
  const { t } = useTranslation("common");
  const [values, setValues] = useState(DONATION_DEFAULTS);
  const [status, setStatus] = useState(() => t("donate.status.default"));
  const [donationSettings, setDonationSettings] = useState({
    enabled: true,
    currency: "EUR",
    minimumMajor: 1
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get("status");
    if (checkoutStatus === "success") {
      setStatus(t("donate.status.success"));
    } else if (checkoutStatus === "cancelled") {
      setStatus(t("donate.status.cancelled"));
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api"))
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) {
          return;
        }
        const donations = data.donations || {};
        const minimumCents = Number(donations.minimum_cents || 100);
        const minimumMajor = Math.max(0.5, minimumCents / 100);
        const currency = String(donations.currency || "eur").toUpperCase();
        setDonationSettings({
          enabled: Boolean(donations.enabled),
          currency,
          minimumMajor
        });
        setValues((current) => ({
          ...current,
          amount_major: Math.max(Number(current.amount_major) || 0, minimumMajor)
        }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDonate(event) {
    event.preventDefault();
    if (!donationSettings.enabled) {
      setStatus(t("donate.status.notConfigured"));
      return;
    }
    setStatus(t("donate.status.creatingSession"));
    const amountCents = Math.round(Number(values.amount_major) * 100);

    try {
      const response = await fetch(apiUrl("/api/donations/checkout-session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: amountCents,
          currency: donationSettings.currency.toLowerCase(),
          name: values.name,
          message: values.message,
          is_public: Boolean(values.is_public)
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || t("donate.status.checkoutStartFailed"));
      }
      if (!data.checkout_url) {
        throw new Error(t("donate.status.checkoutUrlMissing"));
      }
      window.location.assign(data.checkout_url);
    } catch (error) {
      setStatus(error.message || t("donate.status.checkoutStartFailed"));
    }
  }

  return (
    <>
      <section className="hero">
        <h1>{t("donate.hero.title")}</h1>
        <p className="lede">{t("donate.hero.lede")}</p>
      </section>

      <section className="generator-layout">
        <form className="panel controls-panel" onSubmit={handleDonate}>
          <h2>{t("donate.form.title")}</h2>
          <div className="grid">
            <NumberField
              values={values}
              setValues={setValues}
              name="amount_major"
              label={t("donate.form.amount", { currency: donationSettings.currency })}
              min={donationSettings.minimumMajor}
              step="0.5"
              full
            />
            <TextField values={values} setValues={setValues} name="name" label={t("donate.form.publicName")} full />
            <TextField
              values={values}
              setValues={setValues}
              name="message"
              label={t("donate.form.message")}
              placeholder={t("donate.form.messagePlaceholder")}
              full
            />
            <CheckboxField
              values={values}
              setValues={setValues}
              name="is_public"
              label={t("donate.form.isPublic")}
            />
          </div>
          <div className="actions-row">
            <button className="button button-gold" type="submit" disabled={!donationSettings.enabled}>
              {t("donate.form.submit")}
            </button>
          </div>
          <p className="status status-spaced">{status}</p>
        </form>

        <section className="panel preview-panel preview-panel-short">
          <h2>{t("donate.preview.title")}</h2>
          <SponsorsPanel compact />
        </section>
      </section>
    </>
  );
}

function SponsorsPage() {
  const { t } = useTranslation("common");
  const sponsorCtaEnabled = false;

  return (
    <>
      <section className="hero">
        <h1>{t("sponsors.hero.title")}</h1>
        <p className="lede">{t("sponsors.hero.lede")}</p>
      </section>

      <section className="stack">
        <article className="panel prose-panel">
          <h2>{t("sponsors.wall.title")}</h2>
          <SponsorsPanel />
          <div className="actions-row">
            <button
              className="button button-gold sponsor-cta"
              type="button"
              disabled={!sponsorCtaEnabled}
              aria-disabled={!sponsorCtaEnabled}
              title={t("sponsors.wall.ctaDisabledTitle")}
            >
              {t("sponsors.wall.cta")}
            </button>
          </div>
          <p className="status status-spaced">{t("sponsors.wall.status")}</p>
        </article>
      </section>
    </>
  );
}

function EinsteinPage() {
  const { t } = useTranslation("common");
  const [values, setValues] = useState(EINSTEIN_DEFAULTS);
  return (
    <GeneratorLayout
      title={t("generator.einstein.title")}
      description={t("generator.einstein.description")}
      controls={
        <>
          <NumberField values={values} setValues={setValues} name="iterations" label={t("generator.common.iterations")} min={1} max={6} />
          <NumberField values={values} setValues={setValues} name="scalar" label={t("generator.common.scalar")} min={1} max={80} />
          <NumberField values={values} setValues={setValues} name="width" label={t("generator.common.width")} min={64} max={6000} />
          <NumberField values={values} setValues={setValues} name="height" label={t("generator.common.height")} min={64} max={6000} />
          <SelectField
            values={values}
            setValues={setValues}
            name="color_mode"
            label={t("generator.einstein.coloring")}
            options={[
              { value: "families", label: t("generator.einstein.coloringFamilies") },
              { value: "four_color", label: t("generator.einstein.coloringFourColor") }
            ]}
            full
          />
          <SelectField
            values={values}
            setValues={setValues}
            name="format"
            label={t("generator.common.format")}
            options={[
              { value: "png", label: "PNG" },
              { value: "jpg", label: "JPG" },
              { value: "svg", label: "SVG" }
            ]}
            full
          />
          <TextField values={values} setValues={setValues} name="seed" label={t("generator.common.seed")} placeholder={t("generator.common.optional")} full />
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
              <ColorField values={values} setValues={setValues} name="four_color_1" label={t("generator.common.color1")} />
              <ColorField values={values} setValues={setValues} name="four_color_2" label={t("generator.common.color2")} />
              <ColorField values={values} setValues={setValues} name="four_color_3" label={t("generator.common.color3")} />
              <ColorField values={values} setValues={setValues} name="four_color_4" label={t("generator.common.color4")} />
            </div>
          )}
          <CheckboxField
            values={values}
            setValues={setValues}
            name="no_outline"
            label={t("generator.einstein.noOutline")}
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
  const { t } = useTranslation("common");
  const [values, setValues] = useState(SPECTRE_DEFAULTS);
  return (
    <GeneratorLayout
      title={t("generator.spectre.title")}
      description={t("generator.spectre.description")}
      controls={
        <>
          <NumberField values={values} setValues={setValues} name="width" label={t("generator.common.width")} min={64} max={6000} />
          <NumberField values={values} setValues={setValues} name="height" label={t("generator.common.height")} min={64} max={6000} />
          <NumberField values={values} setValues={setValues} name="level" label={t("generator.common.seed")} min={1} max={8} />
          <NumberField values={values} setValues={setValues} name="scale" label={t("generator.common.scale")} min={1} max={120} />
          <NumberField values={values} setValues={setValues} name="center_x" label={t("generator.common.centerX")} step="0.1" />
          <NumberField values={values} setValues={setValues} name="center_y" label={t("generator.common.centerY")} step="0.1" />
          <SelectField
            values={values}
            setValues={setValues}
            name="format"
            label={t("generator.common.format")}
            options={[
              { value: "svg", label: "SVG" },
              { value: "png", label: "PNG" },
              { value: "jpg", label: "JPG" }
            ]}
            full
          />
          <SelectField
            values={values}
            setValues={setValues}
            name="draw_mode"
            label={t("generator.spectre.drawMode")}
            options={[
              { value: "generated", label: t("generator.spectre.drawModeBuild") },
              { value: "translation", label: t("generator.spectre.drawModeTranslation") }
            ]}
            full
          />
          <SelectField
            values={values}
            setValues={setValues}
            name="shape"
            label={t("generator.spectre.shape")}
            options={[
              { value: "straight", label: t("generator.spectre.shapeStraight") },
              { value: "curved", label: t("generator.spectre.shapeCurved") }
            ]}
            full
          />
          <ColorField values={values} setValues={setValues} name="background" label={t("generator.common.background")} full />
          <ColorField values={values} setValues={setValues} name="outline" label={t("generator.common.outline")} full />
          <NumberField values={values} setValues={setValues} name="stroke_width" label={t("generator.common.strokeWidth")} min={0} max={20} step="0.1" />
          <div className="swatches full">
            <ColorField values={values} setValues={setValues} name="palette_1" label={t("generator.common.color1")} />
            <ColorField values={values} setValues={setValues} name="palette_2" label={t("generator.common.color2")} />
            <ColorField values={values} setValues={setValues} name="palette_3" label={t("generator.common.color3")} />
            <ColorField values={values} setValues={setValues} name="palette_4" label={t("generator.common.color4")} />
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
        shape: values.shape,
        background: values.background,
        outline: values.outline,
        stroke_width: Number(values.stroke_width),
        palette: [values.palette_1, values.palette_2, values.palette_3, values.palette_4]
          .map((value) => String(value).trim())
          .filter(Boolean)
      })}
      endpoint={apiUrl("/api/spectre/render")}
      downloadName={(payload) => `spectre.${payload.format}`}
      previewType={(payload) => {
        if (payload.format === "png") {
          return "image/png";
        }
        if (payload.format === "jpg") {
          return "image/jpeg";
        }
        return "image/svg+xml";
      }}
      values={values}
      setValues={setValues}
      defaults={SPECTRE_DEFAULTS}
    />
  );
}

function PenrosePage() {
  const { t } = useTranslation("common");
  const [values, setValues] = useState(PENROSE_DEFAULTS);
  const previousTileModeRef = useRef(PENROSE_DEFAULTS.tile_mode);
  const modeScaleDefaults = { "kite-dart": 320, rhombs: 320, p1: 320 };
  const modeLegacyScales = { "kite-dart": [320], rhombs: [320], p1: [7, 10, 14, 285, 320] };
  const p1PaletteDefaults = ["seagreen", "midnightblue", "sandybrown", "goldenrod"];
  const legacyPaletteDefaults = ["wheat", "midnightblue", "sandybrown", "seagreen"];
  const cartwheelPaletteDefaults = ["lightyellow", "lightcoral", "gainsboro", "dodgerblue"];
  const cartwheelLegacyHexDefaults = ["#ffffb3", "#ff6666", "#e6e6e6", "#0080ff"];

  useEffect(() => {
    const previousMode = previousTileModeRef.current;
    const nextMode = values.tile_mode;
    previousTileModeRef.current = nextMode;

    if (previousMode === nextMode) {
      return;
    }

    setValues((current) => {
      const next = { ...current };
      let changed = false;

      const knownPreviousScales = [
        modeScaleDefaults[previousMode],
        ...(modeLegacyScales[previousMode] || [])
      ];
      if (knownPreviousScales.includes(Number(next.scale))) {
        next.scale = modeScaleDefaults[nextMode];
        changed = true;
      }

      if (nextMode === "p1") {
        const currentPalette = [next.palette_1, next.palette_2, next.palette_3, next.palette_4];
        const paletteLooksDefault =
          currentPalette.every((color, index) => color === legacyPaletteDefaults[index]) ||
          currentPalette.every((color, index) => color === PENROSE_DEFAULTS[`palette_${index + 1}`]);
        if (paletteLooksDefault) {
          [next.palette_1, next.palette_2, next.palette_3, next.palette_4] = p1PaletteDefaults;
          changed = true;
        }
      }
      if (nextMode !== "kite-dart" && next.build_logic !== "default") {
        next.build_logic = "default";
        changed = true;
      }

      return changed ? next : current;
    });
  }, [values.tile_mode, setValues]);

  useEffect(() => {
    if (values.tile_mode !== "kite-dart") {
      return;
    }

    setValues((current) => {
      const currentPalette = [current.palette_1, current.palette_2, current.palette_3, current.palette_4];
      const matchesLegacyDefaults = currentPalette.every((color, index) => color === legacyPaletteDefaults[index]);
      const matchesCartwheelDefaults =
        currentPalette.every((color, index) => color === cartwheelPaletteDefaults[index]) ||
        currentPalette.every((color, index) => color === cartwheelLegacyHexDefaults[index]);

      if (current.build_logic === "cartwheel" && matchesLegacyDefaults) {
        return {
          ...current,
          palette_1: cartwheelPaletteDefaults[0],
          palette_2: cartwheelPaletteDefaults[1],
          palette_3: cartwheelPaletteDefaults[2],
          palette_4: cartwheelPaletteDefaults[3]
        };
      }

      if (current.build_logic === "default" && matchesCartwheelDefaults) {
        return {
          ...current,
          palette_1: legacyPaletteDefaults[0],
          palette_2: legacyPaletteDefaults[1],
          palette_3: legacyPaletteDefaults[2],
          palette_4: legacyPaletteDefaults[3]
        };
      }

      return current;
    });
  }, [values.build_logic, values.tile_mode, setValues]);

  return (
    <GeneratorLayout
      title={t("generator.penrose.title")}
      description={t("generator.penrose.description")}
      controls={
        <>
          <NumberField values={values} setValues={setValues} name="width" label={t("generator.common.width")} min={64} max={6000} />
          <NumberField values={values} setValues={setValues} name="height" label={t("generator.common.height")} min={64} max={6000} />
          <NumberField values={values} setValues={setValues} name="iterations" label={t("generator.common.iterations")} min={0} max={10} />
          <NumberField values={values} setValues={setValues} name="scale" label={t("generator.common.scale")} min={1} max={1200} />
          <NumberField values={values} setValues={setValues} name="center_x" label={t("generator.common.centerX")} step="0.01" />
          <NumberField values={values} setValues={setValues} name="center_y" label={t("generator.common.centerY")} step="0.01" />
          <SelectField
            values={values}
            setValues={setValues}
            name="tile_mode"
            label={t("generator.penrose.tiles")}
            options={[
              { value: "kite-dart", label: t("generator.penrose.tilesP2") },
              { value: "rhombs", label: t("generator.penrose.tilesP3") },
              { value: "p1", label: t("generator.penrose.tilesP1") }
            ]}
          />
          {values.tile_mode === "kite-dart" ? (
            <SelectField
              values={values}
              setValues={setValues}
              name="build_logic"
              label={t("generator.penrose.buildLogic")}
              options={[
                { value: "default", label: t("generator.penrose.buildLogicDefault") },
                { value: "cartwheel", label: t("generator.penrose.buildLogicCartwheel") }
              ]}
            />
          ) : null}
          <SelectField
            values={values}
            setValues={setValues}
            name="format"
            label={t("generator.common.format")}
            options={[
              { value: "svg", label: "SVG" },
              { value: "png", label: "PNG" },
              { value: "jpg", label: "JPG" }
            ]}
            full
          />
          <ColorField values={values} setValues={setValues} name="background" label={t("generator.common.background")} full />
          <ColorField values={values} setValues={setValues} name="outline" label={t("generator.common.outline")} full />
          <NumberField values={values} setValues={setValues} name="stroke_width" label={t("generator.common.strokeWidth")} min={0} max={20} step="0.1" />
          <div className="swatches full">
            <ColorField values={values} setValues={setValues} name="palette_1" label={t("generator.common.color1")} />
            <ColorField values={values} setValues={setValues} name="palette_2" label={t("generator.common.color2")} />
            <ColorField values={values} setValues={setValues} name="palette_3" label={t("generator.common.color3")} />
            <ColorField values={values} setValues={setValues} name="palette_4" label={t("generator.common.color4")} />
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
        build_logic: values.build_logic,
        tile_mode: values.tile_mode,
        background: values.background,
        outline: values.outline,
        stroke_width: Number(values.stroke_width),
        palette: [values.palette_1, values.palette_2, values.palette_3, values.palette_4]
          .map((value) => String(value).trim())
          .filter(Boolean)
      })}
      endpoint={apiUrl("/api/penrose/render")}
      downloadName={(payload) => `penrose.${payload.format}`}
      previewType={(payload) => {
        if (payload.format === "png") {
          return "image/png";
        }
        if (payload.format === "jpg") {
          return "image/jpeg";
        }
        return "image/svg+xml";
      }}
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
  const { t } = useTranslation("common");
  const [status, setStatus] = useState(() => t("generator.status.ready"));
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
    setStatus(t("generator.status.rendering"));

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || t("generator.status.failed"));
      }

      const blob = await response.blob();
      const typedBlob = new Blob([blob], { type: previewType(requestPayload) });
      const nextUrl = URL.createObjectURL(typedBlob);
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
      }
      lastUrlRef.current = nextUrl;
      setPreviewUrl(nextUrl);
      setStatus(t("generator.status.complete"));
    } catch (error) {
      setStatus(error.message || t("generator.status.failed"));
    }
  }

  function reset() {
    setValues(defaults);
    setStatus(t("generator.status.reset"));
  }

  return (
    <>
      <section className="hero">
        <h1>{title}</h1>
        <p className="lede">{description}</p>
      </section>

      <section className="generator-layout">
        <form className="panel controls-panel" onSubmit={handleSubmit}>
          <h2>{t("generator.layout.settings")}</h2>
          <div className="grid">{controls}</div>
          <div className="actions-row">
            <button className="button" type="submit">
              {t("generator.layout.generate")}
            </button>
            <button className="button button-muted" type="button" onClick={reset}>
              {t("generator.layout.reset")}
            </button>
          </div>
        </form>

        <section className="panel preview-panel">
          <h2>{t("generator.layout.preview")}</h2>
          <div className="meta">
            <div className="status">{status}</div>
            {previewUrl ? (
              <a className="button button-green small" href={previewUrl} download={downloadName(payload())}>
                {t("generator.layout.download")}
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
                {t("generator.layout.placeholder")}
              </div>
            )}
          </div>
        </section>
      </section>
    </>
  );
}

function AboutPage() {
  const { t } = useTranslation("common");
  const [content, setContent] = useState(() => createAboutFallback(t));

  useEffect(() => {
    setContent((current) => (current === null ? createAboutFallback(t) : current));
  }, [t]);

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
          <h2>{t("about.sections.references")}</h2>
          <ul className="reference-list">
            {content.references.map((reference) => (
              <li key={reference.url}>
                <a href={reference.url}>{reference.label}</a>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel prose-panel">
          <h2>{t("about.sections.credits")}</h2>
          <p>{content.credits}</p>
        </article>

        <article className="panel prose-panel">
          <h2>{t("about.sections.technical")}</h2>
          <p>{content.technical_realizations}</p>
        </article>

        <article className="panel prose-panel">
          <h2>{t("about.sections.notes")}</h2>
          <p>{content.notes}</p>
        </article>
      </section>
    </>
  );
}

function SponsorsPanel({ compact = false }) {
  const { t } = useTranslation("common");
  const [sponsors, setSponsors] = useState([]);
  const [status, setStatus] = useState(() => t("sponsors.panel.loading"));

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/sponsors"))
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) {
          return;
        }
        const entries = Array.isArray(data.sponsors) ? data.sponsors : [];
        setSponsors(entries);
        setStatus(entries.length > 0 ? "" : t("sponsors.panel.none"));
      })
      .catch(() => {
        if (!cancelled) {
          setStatus(t("sponsors.panel.none"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  if (status) {
    return <p className="status">{status}</p>;
  }

  const items = compact ? sponsors.slice(0, 8) : sponsors;
  return (
    <ul className="sponsor-list">
      {items.map((entry, index) => (
        <li key={`${entry.name}-${entry.created_at}-${index}`} className="sponsor-item">
          <span className="sponsor-name">{entry.name}</span>
          <span className="sponsor-meta">
            {formatDonationAmount(entry.amount_cents, entry.currency)} · {formatSponsorDate(entry.created_at)}
          </span>
          {entry.message ? <p className="sponsor-message">{entry.message}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function formatDonationAmount(amountCents, currencyCode) {
  const amount = Number(amountCents || 0) / 100;
  const currency = String(currencyCode || "eur").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatSponsorDate(isoDateString) {
  if (!isoDateString) {
    return "";
  }
  const date = new Date(isoDateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString();
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

function ColorField({ values, setValues, name, label, placeholder, full = false }) {
  const { t } = useTranslation("common");
  const listId = `color-options-${name}`;
  const cachedValueRef = useRef("");
  const autoClearedRef = useRef(false);
  const resolvedPlaceholder = placeholder || t("generator.common.colorPlaceholder");

  function handleFocus() {
    const currentValue = String(values[name] ?? "");
    cachedValueRef.current = currentValue;
    if (!currentValue) {
      autoClearedRef.current = false;
      return;
    }
    autoClearedRef.current = true;
    setValues((current) => ({ ...current, [name]: "" }));
  }

  function handleBlur() {
    const currentValue = String(values[name] ?? "").trim();
    if (autoClearedRef.current && !currentValue) {
      const restored = cachedValueRef.current;
      setValues((current) => ({ ...current, [name]: restored }));
    }
    autoClearedRef.current = false;
  }

  return (
    <label className={full ? "full color-field" : "color-field"}>
      <span>{label}</span>
      <div className="color-input-wrap">
        <span className="color-chip" style={{ background: values[name] || "transparent" }} aria-hidden="true" />
        <input
          name={name}
          type="text"
          list={listId}
          placeholder={resolvedPlaceholder}
          value={values[name]}
          onFocus={handleFocus}
          onBlur={handleBlur}
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
