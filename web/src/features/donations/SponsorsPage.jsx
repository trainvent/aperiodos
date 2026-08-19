import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import DonationForm from "./DonationForm";
import SponsorsPanel from "./SponsorsPanel";

export default function SponsorsPage() {
  const { t } = useTranslation("common");
  const [sponsorRefreshToken, setSponsorRefreshToken] = useState(0);
  const refreshSponsors = useCallback(() => {
    setSponsorRefreshToken((current) => current + 1);
  }, []);

  return (
    <section className="sponsors-page">
      <header className="sponsors-intro">
        <p className="eyebrow">{t("sponsors.support.eyebrow")}</p>
        <h2>{t("sponsors.support.title")}</h2>
        <p>{t("sponsors.support.body")}</p>
      </header>

      <div className="sponsors-grid">
        <article className="panel prose-panel sponsor-group-panel">
          <div className="sponsor-group-heading">
            <span className="sponsor-group-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="3.25" />
                <path d="M5.75 19c.45-3.6 2.53-5.5 6.25-5.5s5.8 1.9 6.25 5.5" />
              </svg>
            </span>
            <div>
              <h2>{t("sponsors.people.title")}</h2>
              <p>{t("sponsors.people.description")}</p>
            </div>
          </div>
          <SponsorsPanel refreshToken={sponsorRefreshToken} />
          <DonationForm
            className="sponsor-donation-form"
            inlineName
            returnPath="/sponsors"
            onSponsorRecorded={refreshSponsors}
          />
        </article>

        <article className="panel prose-panel sponsor-group-panel sponsor-institutions">
          <div className="sponsor-group-heading">
            <span className="sponsor-group-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 9h16L12 4 4 9Z" />
                <path d="M6.5 10.5v6M10.2 10.5v6M13.8 10.5v6M17.5 10.5v6M4.5 19h15" />
              </svg>
            </span>
            <div>
              <h2>{t("sponsors.institutions.title")}</h2>
              <p>{t("sponsors.institutions.description")}</p>
            </div>
          </div>
          <div className="sponsor-logo-placeholder">
            <span>{t("sponsors.institutions.placeholder")}</span>
          </div>
          <div className="actions-row sponsor-group-actions">
            <a className="button button-ink" href="mailto:finance@trainvent.com">
              {t("sponsors.institutions.contact")}
            </a>
          </div>
        </article>
      </div>
    </section>
  );
}
