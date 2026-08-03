import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiUrl } from "../../lib/api";

export default function SponsorsPanel({ compact = false, refreshToken = 0 }) {
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
  }, [t, refreshToken]);

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


