import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";

import { apiUrl } from "../../lib/api";

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
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [creditCode, setCreditCode] = useState("");
  const [resettingDevQuota, setResettingDevQuota] = useState(false);
  const lastUrlRef = useRef("");
  const isDevelopment = process.env.NODE_ENV === "development";

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
        headers: {
          "Content-Type": "application/json",
          ...(creditCode.trim() ? { "X-Render-Credit-Code": creditCode.trim() } : {}),
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 429) {
          if (response.headers.get("X-RateLimit-Scope") === "global") {
            throw new Error(t("generator.status.serviceDailyLimit"));
          }
          const limit = Number.parseInt(response.headers.get("X-RateLimit-Limit") || "3", 10);
          setQuotaExhausted(true);
          throw new Error(t("generator.status.dailyLimit", { count: limit }));
        }
        if (response.status === 403 && creditCode.trim()) {
          setQuotaExhausted(true);
          throw new Error(data.error || t("generator.credits.invalid"));
        }
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
      const remaining = Number.parseInt(response.headers.get("X-RateLimit-Remaining") || "", 10);
      const usedCredit = response.headers.get("X-Render-Credit-Used") === "true";
      if (usedCredit) setCreditCode("");
      setStatus(
        Number.isFinite(remaining)
          ? usedCredit
            ? t("generator.status.completeWithCode")
            : t("generator.status.completeRemaining", { count: remaining })
          : t("generator.status.complete"),
      );
    } catch (error) {
      setStatus(error.message || t("generator.status.failed"));
    }
  }

  function reset() {
    setValues(defaults);
    setStatus(t("generator.status.reset"));
  }

  async function resetDevQuota() {
    setResettingDevQuota(true);
    setStatus(t("generator.status.devQuotaResetting"));
    try {
      const response = await fetch(apiUrl("/api/dev/render-quota/reset"), { method: "POST" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || t("generator.status.devQuotaResetFailed"));
      }
      setQuotaExhausted(false);
      setCreditCode("");
      setStatus(t("generator.status.devQuotaReset"));
    } catch (error) {
      setStatus(error.message || t("generator.status.devQuotaResetFailed"));
    } finally {
      setResettingDevQuota(false);
    }
  }

  return (
    <>
      {description ? <p className="generator-description">{description}</p> : null}
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
            {isDevelopment ? (
              <button className="button button-muted" type="button" onClick={resetDevQuota} disabled={resettingDevQuota}>
                {t("generator.layout.devQuotaReset")}
              </button>
            ) : null}
          </div>
          {quotaExhausted ? (
            <div className="credit-redeem">
              <h3>{t("generator.credits.title")}</h3>
              <p>{t("generator.credits.help")}</p>
              <label>
                {t("generator.credits.label")}
                <input
                  value={creditCode}
                  onChange={(event) => setCreditCode(event.target.value)}
                  placeholder="AP00-0000-0000-0000-0000-00"
                  autoComplete="off"
                />
              </label>
              <Link className="button button-gold small" href="/generation-codes">
                {t("generator.credits.buy")}
              </Link>
            </div>
          ) : null}
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
