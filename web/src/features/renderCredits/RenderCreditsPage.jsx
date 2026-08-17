import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiUrl } from "../../lib/api";

export default function RenderCreditsPage() {
  const { t, i18n } = useTranslation("common");
  const language = i18n.resolvedLanguage === "de" ? "de" : "en";
  const [status, setStatus] = useState("");
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const confirmedSessionRef = useRef("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get("render_credits");
    const sessionId = params.get("session_id") || "";
    if (checkoutStatus === "cancelled") {
      setStatus(t("renderCredits.status.cancelled"));
      return;
    }
    if (checkoutStatus !== "success" || !sessionId || confirmedSessionRef.current === sessionId) return;
    confirmedSessionRef.current = sessionId;
    setLoading(true);
    setStatus(t("renderCredits.status.confirming"));
    fetch(apiUrl("/api/render-credits/confirm-session"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || t("renderCredits.status.confirmFailed"));
        const issuedCodes = Array.isArray(data.codes) ? data.codes : [];
        setCodes(issuedCodes);
        setStatus(t("renderCredits.status.ready"));
        const pdfUrl = apiUrl(`/api/render-credits/codes.pdf?session_id=${encodeURIComponent(sessionId)}&lang=${language}`);
        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = "aperiodos-generation-codes.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch((error) => setStatus(error.message || t("renderCredits.status.confirmFailed")))
      .finally(() => setLoading(false));
  }, [t, language]);

  async function startCheckout() {
    setLoading(true);
    setStatus(t("renderCredits.status.checkout"));
    try {
      const response = await fetch(apiUrl("/api/render-credits/checkout-session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ return_path: "/generation-codes" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t("renderCredits.status.checkoutFailed"));
      if (!data.checkout_url) throw new Error(t("renderCredits.status.checkoutFailed"));
      window.location.assign(data.checkout_url);
    } catch (error) {
      setStatus(error.message || t("renderCredits.status.checkoutFailed"));
      setLoading(false);
    }
  }

  async function copyAllCodes() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopyStatus(t("renderCredits.delivery.copied"));
    } catch {
      setCopyStatus(t("renderCredits.delivery.copyFailed"));
    }
  }

  const sessionId = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("session_id") || "";
  const pdfUrl = sessionId
    ? apiUrl(`/api/render-credits/codes.pdf?session_id=${encodeURIComponent(sessionId)}&lang=${language}`)
    : "";

  return (
    <>
      <section className="hero">
        <h1>{t("renderCredits.hero.title")}</h1>
        <p className="lede">{t("renderCredits.hero.lede")}</p>
      </section>
      <section className="credits-layout">
        <section className="panel credits-product">
          <div>
            <span className="tag">{t("renderCredits.product.tag")}</span>
            <h2>{t("renderCredits.product.title")}</h2>
            <p>{t("renderCredits.product.description")}</p>
          </div>
          <div className="credits-price">€5</div>
          <ul className="credits-benefits">
            <li>{t("renderCredits.product.singleUse")}</li>
            <li>{t("renderCredits.product.noExpiry")}</li>
            <li>{t("renderCredits.product.pdf")}</li>
          </ul>
          <button className="button button-gold" type="button" onClick={startCheckout} disabled={loading}>
            {t("renderCredits.product.buy")}
          </button>
          {status ? <p className="status status-spaced">{status}</p> : null}
        </section>

        <section className="panel credits-delivery">
          <h2>{t("renderCredits.delivery.title")}</h2>
          {codes.length ? (
            <>
              <p>{t("renderCredits.delivery.help")}</p>
              <ol className="credits-code-list">
                {codes.map((code) => <li key={code}><code>{code}</code></li>)}
              </ol>
              <div className="actions-row">
                <button className="button button-muted" type="button" onClick={copyAllCodes}>
                  {t("renderCredits.delivery.copyAll")}
                </button>
                {pdfUrl ? <a className="button button-green" href={pdfUrl}>{t("renderCredits.delivery.download")}</a> : null}
              </div>
              {copyStatus ? <p className="status" role="status">{copyStatus}</p> : null}
            </>
          ) : <p className="status">{t("renderCredits.delivery.empty")}</p>}
        </section>
      </section>
    </>
  );
}
