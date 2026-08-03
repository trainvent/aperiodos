import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export default function GeneratorLayout({
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
