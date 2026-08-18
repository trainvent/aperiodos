import Link from "next/link";
import { useTranslation } from "react-i18next";

import SponsorsPanel from "./SponsorsPanel";

export default function SponsorsPage() {
  const { t } = useTranslation("common");

  return (
    <section className="stack">
        <article className="panel prose-panel">
          <h2>{t("sponsors.wall.title")}</h2>
          <SponsorsPanel />
          <div className="actions-row">
            <Link className="button button-gold sponsor-cta" href="/donate">
              {t("sponsors.wall.cta")}
            </Link>
          </div>
          <p className="status status-spaced">{t("sponsors.wall.status")}</p>
        </article>
    </section>
  );
}
