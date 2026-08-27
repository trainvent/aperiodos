import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";

import HintPopup from "../../components/HintPopup";
import { apiUrl } from "../../lib/api";
import { renderBrowserPreview } from "../../lib/rendererPreview";

const RENDER_HINT_DISMISSED_KEY = "aperiodos.renderHintDismissed";

export default function GeneratorLayout({
  title,
  controls,
  payload,
  endpoint,
  downloadName,
  previewType,
  generator,
  values,
  setValues,
  defaults
}) {
  const { t } = useTranslation("common");
  const [previewStatus, setPreviewStatus] = useState(() => t("generator.status.localPreviewLoading"));
  const [previewHint, setPreviewHint] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewRequest, setPreviewRequest] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadFilename, setDownloadFilename] = useState("");
  const [showRenderHint, setShowRenderHint] = useState(false);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [creditCode, setCreditCode] = useState("");
  const [resettingDevQuota, setResettingDevQuota] = useState(false);
  const lastUrlRef = useRef("");
  const lastDownloadUrlRef = useRef("");
  const renderedBlobRef = useRef(null);
  const settingsVersionRef = useRef(0);
  const isDevelopment = process.env.NODE_ENV === "development";

  useEffect(() => {
    return () => {
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
      }
      if (lastDownloadUrlRef.current && lastDownloadUrlRef.current !== lastUrlRef.current) {
        URL.revokeObjectURL(lastDownloadUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!generator) return undefined;
    settingsVersionRef.current += 1;
    setShowRenderHint(false);
    setPreviewStatus(lastUrlRef.current ? "" : t("generator.status.localPreviewLoading"));
    setPreviewHint(lastUrlRef.current ? t("generator.status.localPreviewStale") : "");
    setExportStatus("");
    renderedBlobRef.current = null;
    if (lastDownloadUrlRef.current) {
      URL.revokeObjectURL(lastDownloadUrlRef.current);
      lastDownloadUrlRef.current = "";
      setDownloadUrl("");
      setDownloadFilename("");
    }
    return undefined;
  }, [generator, values]);

  useEffect(() => {
    if (!generator) return undefined;
    const settingsVersion = settingsVersionRef.current;
    setPreviewStatus(t("generator.status.localPreviewUpdating"));
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const svg = await renderBrowserPreview(generator, payload());
        if (cancelled || settingsVersion !== settingsVersionRef.current) return;
        const nextUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        if (lastUrlRef.current && lastUrlRef.current !== lastDownloadUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = nextUrl;
        setPreviewUrl(nextUrl);
        setPreviewStatus("");
        setShowRenderHint(true);
      } catch {
        // Full server renders remain available if WebAssembly is unsupported.
      }
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [generator, previewRequest]);

  async function handleSubmit(event) {
    event.preventDefault();
    const requestPayload = payload();
    setExporting(true);
    setExportStatus(t("generator.status.rendering"));

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
      if (lastDownloadUrlRef.current) {
        URL.revokeObjectURL(lastDownloadUrlRef.current);
      }
      lastDownloadUrlRef.current = nextUrl;
      renderedBlobRef.current = typedBlob;
      setDownloadUrl(nextUrl);
      const filename = downloadName(requestPayload);
      setDownloadFilename(filename);
      const remaining = Number.parseInt(response.headers.get("X-RateLimit-Remaining") || "", 10);
      const usedCredit = response.headers.get("X-Render-Credit-Used") === "true";
      if (usedCredit) setCreditCode("");
      setExportStatus(
        Number.isFinite(remaining)
          ? usedCredit
            ? t("generator.status.completeWithCode")
            : t("generator.status.completeRemaining", { count: remaining })
          : t("generator.status.complete"),
      );
    } catch (error) {
      setExportStatus(error.message || t("generator.status.failed"));
    } finally {
      setExporting(false);
    }
  }

  function reset() {
    setValues(defaults);
    setPreviewStatus(t("generator.status.reset"));
    setExportStatus("");
  }

  async function shareRenderedFile() {
    if (!renderedBlobRef.current || !downloadFilename) return;
    const file = new File([renderedBlobRef.current], downloadFilename, { type: renderedBlobRef.current.type });
    if (!navigator.share || (navigator.canShare && !navigator.canShare({ files: [file] }))) {
      setExportStatus(t("generator.status.shareUnavailable"));
      return;
    }
    try {
      await navigator.share({ files: [file], title: downloadFilename });
      setExportStatus(t("generator.status.shared"));
    } catch (error) {
      if (error?.name !== "AbortError") setExportStatus(t("generator.status.shareFailed"));
    }
  }

  async function resetDevQuota() {
    setResettingDevQuota(true);
    setExportStatus(t("generator.status.devQuotaResetting"));
    try {
      const response = await fetch(apiUrl("/api/dev/render-quota/reset"), { method: "POST" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || t("generator.status.devQuotaResetFailed"));
      }
      setQuotaExhausted(false);
      setCreditCode("");
      setExportStatus(t("generator.status.devQuotaReset"));
    } catch (error) {
      setExportStatus(error.message || t("generator.status.devQuotaResetFailed"));
    } finally {
      setResettingDevQuota(false);
    }
  }

  return (
    <section className="generator-layout">
        <form id="generator-settings-form" className="panel controls-panel" onSubmit={handleSubmit}>
          <h2>{t("generator.layout.settings")}</h2>
          <div className="grid">{controls}</div>
          <div className="actions-row">
            <div className="hint-anchor">
              <HintPopup open={Boolean(previewHint)} onDismiss={() => setPreviewHint("")}>
                {previewHint}
              </HintPopup>
              <button className="button" type="button" onClick={() => {
                setPreviewHint("");
                setPreviewStatus(t("generator.status.localPreviewUpdating"));
                setPreviewRequest((request) => request + 1);
              }}>
                <PreviewIcon />
                {t("generator.layout.preview")}
              </button>
            </div>
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
          <div className="preview-heading">
            <h2>{t("generator.layout.localPreview")}</h2>
            <div className="render-actions">
              {downloadUrl ? (
                <>
                  <button
                    className="render-action"
                    type="button"
                    onClick={shareRenderedFile}
                    aria-label={t("generator.layout.share")}
                    title={t("generator.layout.share")}
                  >
                    <ShareIcon />
                  </button>
                  <a
                    className="render-action"
                    href={downloadUrl}
                    download={downloadFilename}
                    aria-label={t("generator.layout.download")}
                    title={t("generator.layout.download")}
                  >
                    <DownloadIcon />
                  </a>
                </>
              ) : (
                <div className="render-control">
                  <HintPopup
                    open={showRenderHint}
                    onDismiss={() => setShowRenderHint(false)}
                    storageKey={RENDER_HINT_DISMISSED_KEY}
                  >
                    {t("generator.status.renderHint")}
                  </HintPopup>
                  <button
                    className="button small render-button"
                    type="submit"
                    form="generator-settings-form"
                    disabled={exporting}
                  >
                    <RenderIcon />
                    {exporting ? t("generator.status.rendering") : t("generator.layout.render")}
                  </button>
                </div>
              )}
            </div>
          </div>
          {!downloadUrl && previewStatus ? (
            <div className="meta">
              <div className="status">{previewStatus}</div>
            </div>
          ) : null}
          {exportStatus ? <div className="render-status">{exportStatus}</div> : null}
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
  );
}

function PreviewIcon() {
  return <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.75" /></svg>;
}

function RenderIcon() {
  return <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m13.5 2-1.1 4.4L8 7.5l4.4 1.1 1.1 4.4 1.1-4.4L19 7.5l-4.4-1.1L13.5 2Z" /><path d="m6.5 11-.8 3.2-3.2.8 3.2.8.8 3.2.8-3.2 3.2-.8-3.2-.8L6.5 11Z" /><path d="m18 14-.6 2.4-2.4.6 2.4.6L18 20l.6-2.4L21 17l-2.4-.6L18 14Z" /></svg>;
}

function ShareIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" /></svg>;
}

function DownloadIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 20h16" /></svg>;
}
