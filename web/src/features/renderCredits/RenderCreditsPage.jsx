import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiUrl } from "../../lib/api";

function FeedbackMessage({ message, tone = "info" }) {
  if (!message) return null;
  const icon = tone === "success" ? "✓" : tone === "error" ? "×" : "…";
  return (
    <p className={`feedback-message feedback-${tone}`} role="status" aria-live="polite">
      <span className="feedback-icon" aria-hidden="true">{icon}</span>
      <span>{message}</span>
    </p>
  );
}

export default function RenderCreditsPage() {
  const { t, i18n } = useTranslation("common");
  const language = i18n.resolvedLanguage === "de" ? "de" : "en";
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState("info");
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [emailDeliveryStatus, setEmailDeliveryStatus] = useState("");
  const confirmedSessionRef = useRef("");
  const emailPollRef = useRef(0);

  async function pollEmailDeliveryStatus(sessionId) {
    const pollId = ++emailPollRef.current;
    setEmailDeliveryStatus("pending");
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const response = await fetch(apiUrl(`/api/render-credits/email-status?session_id=${encodeURIComponent(sessionId)}`), {
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (pollId !== emailPollRef.current) return;
        if (response.ok && ["pending", "sending", "sent", "failed"].includes(data.status)) {
          setEmailDeliveryStatus(data.status);
          if (data.status === "sent" || data.status === "failed") return;
        }
      } catch {
        // A short-lived polling error should not hide a later delivery result.
      }
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
    if (pollId === emailPollRef.current) setEmailDeliveryStatus("delayed");
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get("render_credits");
    const sessionId = params.get("session_id") || "";
    if (checkoutStatus === "cancelled") {
      setStatus(t("renderCredits.status.cancelled"));
      setStatusTone("error");
      return;
    }
    if (checkoutStatus !== "success" || !sessionId || confirmedSessionRef.current === sessionId) return;
    confirmedSessionRef.current = sessionId;
    setLoading(true);
    setStatus(t("renderCredits.status.confirming"));
    setStatusTone("info");
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
        setStatusTone("success");
        void pollEmailDeliveryStatus(sessionId);
        const pdfUrl = apiUrl(`/api/render-credits/codes.pdf?session_id=${encodeURIComponent(sessionId)}&lang=${language}`);
        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = "aperiodos-generation-codes.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch((error) => {
        setStatus(error.message || t("renderCredits.status.confirmFailed"));
        setStatusTone("error");
      })
      .finally(() => setLoading(false));
  }, [t, language]);

  async function startCheckout() {
    setLoading(true);
    setStatus(t("renderCredits.status.checkout"));
    setStatusTone("info");
    try {
      const response = await fetch(apiUrl("/api/render-credits/checkout-session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ return_path: "/generation-codes", language }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t("renderCredits.status.checkoutFailed"));
      if (!data.checkout_url) throw new Error(t("renderCredits.status.checkoutFailed"));
      window.location.assign(data.checkout_url);
    } catch (error) {
      setStatus(error.message || t("renderCredits.status.checkoutFailed"));
      setStatusTone("error");
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
  const emailStatusMessage = emailDeliveryStatus
    ? t(`renderCredits.email.${emailDeliveryStatus}`)
    : "";
  const emailStatusTone = emailDeliveryStatus === "sent"
    ? "success"
    : emailDeliveryStatus === "failed" ? "error" : "info";

  return (
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
          <div className="feedback-stack">
            <FeedbackMessage message={status} tone={statusTone} />
            <FeedbackMessage message={emailStatusMessage} tone={emailStatusTone} />
          </div>
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
  );
}
