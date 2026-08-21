import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { apiUrl } from "../../lib/api";

function createAboutFallback(t) {
  return {
    title: t("about.hero.title"),
    summary: t("about.hero.summary"),
    references: [
      {
        label: "Trainvent",
        url: "https://next.trainvent.com/"
      },
      {
        label: t("about.references.hat"),
        url: "https://cs.uwaterloo.ca/~csk/hat/h7h8.html"
      },
      {
        label: t("about.references.spectre"),
        url: "https://cs.uwaterloo.ca/~csk/spectre/"
      },
      {
        label: t("about.references.aperiodicArticle"),
        url: "https://www.chiark.greenend.org.uk/~sgtatham/quasiblog/aperiodic-tilings/"
      },
      {
        label: t("about.references.einsteinRepo"),
        url: "https://github.com/asmoly/Einstein_Tile_Generator"
      },
      {
        label: t("about.references.spectreRepo"),
        url: "https://github.com/necocen/spectre"
      },
      {
        label: "OpenAI",
        url: "https://openai.com/"
      }
    ],
    credits: t("about.sections.creditsBody"),
    technical_realizations: t("about.sections.technicalBody"),
    notes: t("about.sections.notesBody")
  };
}

export default function AboutPage() {
  const { t, i18n } = useTranslation("common");
  const language = i18n.resolvedLanguage === "en" ? "en" : "de";
  const [content, setContent] = useState(() => createAboutFallback(t));

  useEffect(() => {
    setContent(createAboutFallback(t));
  }, [t, language]);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl(`/api/about?lang=${encodeURIComponent(language)}`))
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setContent(data);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [language]);

  return (
    <section className="about-grid">
        <article className="panel prose-panel about-intro">
          <p>{content.summary}</p>
        </article>

        <article className="panel prose-panel">
          <h2>{t("about.sections.references")}</h2>
          <ul className="reference-list">
            {content.references.map((reference) => (
              <li key={reference.url}>
                <a href={reference.url}>{reference.label}</a>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel prose-panel">
          <h2>{t("about.sections.credits")}</h2>
          <p>{content.credits}</p>
        </article>

        <article className="panel prose-panel">
          <h2>{t("about.sections.technical")}</h2>
          <p>{content.technical_realizations}</p>
        </article>

        <article className="panel prose-panel">
          <h2>{t("about.sections.notes")}</h2>
          <p>{content.notes}</p>
        </article>
    </section>
  );
}
