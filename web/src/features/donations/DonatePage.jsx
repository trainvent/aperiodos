import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { NumberField, SelectField, TextField } from "../../components/forms/FormFields";
import { apiUrl } from "../../lib/api";
import { DONATION_CURRENCY_OPTIONS, DONATION_DEFAULTS } from "./config";
import SponsorsPanel from "./SponsorsPanel";

export default function DonatePage() {
  const { t } = useTranslation("common");
  const [values, setValues] = useState(DONATION_DEFAULTS);
  const [status, setStatus] = useState(() => t("donate.status.default"));
  const [sponsorRefreshToken, setSponsorRefreshToken] = useState(0);
  const [donationSettings, setDonationSettings] = useState({
    enabled: true,
    currency: "EUR",
    supportedCurrencies: DONATION_CURRENCY_OPTIONS.map((option) => option.value),
    minimumMajor: 1
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get("status");
    const sessionId = params.get("session_id");
    if (checkoutStatus === "success") {
      setStatus(t("donate.status.success"));
      if (sessionId) {
        fetch(apiUrl("/api/donations/confirm-session"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId })
        })
          .then((response) => response.json().catch(() => ({})))
          .then((data) => {
            if (data.recorded) {
              setStatus(t("donate.status.confirmed"));
              setSponsorRefreshToken((current) => current + 1);
            }
          })
          .catch(() => undefined);
      }
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
        const supportedCurrencies = Array.isArray(donations.supported_currencies)
          ? donations.supported_currencies.map((entry) => String(entry).toUpperCase())
          : DONATION_CURRENCY_OPTIONS.map((option) => option.value);
        const fallbackCurrency = String(donations.currency || "eur").toUpperCase();
        const currency = supportedCurrencies.includes(fallbackCurrency) ? fallbackCurrency : "EUR";
        setDonationSettings({
          enabled: Boolean(donations.enabled),
          currency,
          supportedCurrencies,
          minimumMajor
        });
        setValues((current) => ({
          ...current,
          currency: supportedCurrencies.includes(current.currency) ? current.currency : currency,
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
          currency: values.currency.toLowerCase(),
          name: values.name,
          message: values.message,
          is_public: true
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
    <section className="generator-layout">
        <form className="panel controls-panel" onSubmit={handleDonate}>
          <h2>{t("donate.form.title")}</h2>
          <div className="grid">
            <SelectField
              values={values}
              setValues={setValues}
              name="currency"
              label={t("donate.form.currency")}
              options={DONATION_CURRENCY_OPTIONS.filter((option) => donationSettings.supportedCurrencies.includes(option.value))}
            />
            <NumberField
              values={values}
              setValues={setValues}
              name="amount_major"
              label={t("donate.form.amount")}
              min={donationSettings.minimumMajor}
              step="0.5"
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
          <SponsorsPanel compact refreshToken={sponsorRefreshToken} />
        </section>
    </section>
  );
}
