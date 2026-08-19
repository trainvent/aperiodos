import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import DonationForm from "./DonationForm";
import SponsorsPanel from "./SponsorsPanel";

export default function DonatePage() {
  const { t } = useTranslation("common");
  const [sponsorRefreshToken, setSponsorRefreshToken] = useState(0);
  const refreshSponsors = useCallback(() => {
    setSponsorRefreshToken((current) => current + 1);
  }, []);

  return (
    <section className="generator-layout">
      <DonationForm
        className="panel controls-panel"
        returnPath="/donate"
        onSponsorRecorded={refreshSponsors}
      />

      <section className="panel preview-panel preview-panel-short">
        <h2>{t("donate.preview.title")}</h2>
        <SponsorsPanel compact refreshToken={sponsorRefreshToken} />
      </section>
    </section>
  );
}
