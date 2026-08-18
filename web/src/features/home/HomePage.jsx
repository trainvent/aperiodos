import Link from "next/link";
import { useTranslation } from "react-i18next";

import TileExample from "./TileExample";

export default function HomePage() {
  const { t } = useTranslation("common");

  const monotileCards = [
    {
      title: "Einstein",
      description: t("home.cards.einsteinDescription"),
      to: "/einstein",
      className: "feature-einstein",
      buttonClassName: "button",
      arrow: true,
      arrowColor: "seagreen",
      example: "einstein"
    },
    {
      title: "Spectre",
      description: t("home.cards.spectreDescription"),
      to: "/spectre",
      className: "feature-spectre",
      buttonClassName: "button button-green",
      arrow: true,
      arrowColor: "sienna",
      example: "spectre"
    }
  ];

  const otherCards = [
    {
      title: "Penrose",
      description: t("home.cards.penroseDescription"),
      to: "/penrose",
      className: "feature-penrose",
      buttonClassName: "button button-ink",
      arrow: true,
      arrowColor: "red",
      example: "penrose"
    }
  ];

  return (
    <>
      <section className="home-intro">
        <div className="home-intro-workflow">
          <strong>{t("home.hero.workflow")}</strong>
          <p className="home-intro-copy">{t("home.hero.lede")}</p>
        </div>
        <div className="home-intro-tools">
          <strong>{t("home.hero.tools")}</strong>
          <p className="home-intro-copy">{t("home.hero.toolsText")}</p>
        </div>
      </section>

      <section className="card-grid">
        <div className="card-group panel-group monotile-group">
          <article className="feature-card monotile-merged panel">
            <div className="panel-kicker"><span className="group-title">{t("home.groups.monotile")}</span></div>
            <div className="monotile-inner">
              {monotileCards.map((card) => (
                <div className="monotile-card" key={card.title}>
                  <h2>{card.title}</h2>
                  <p>{card.description}</p>
                  <div className="feature-spacer" aria-hidden="true" />
                  <div className="feature-card-footer">
                    <TileExample type={card.example} />
                    <Link
                      className={card.buttonClassName}
                      href={card.to}
                      aria-label={`${t("home.openLabel")} ${card.title}`}
                    >
                      {card.arrow ? (
                        <span
                          className="card-cta"
                          aria-hidden="true"
                          style={card.arrowColor ? { ['--cta-color']: card.arrowColor } : undefined}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      ) : null}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="card-group panel-group">
          <div className="group-cards">
            {otherCards.map((card, index) => (
                <article key={card.title} className={`feature-card ${card.className} panel`}>
                {index === 0 ? <div className="panel-kicker"><span className="group-title">{t("home.groups.tileCombinations")}</span></div> : null}
                <h2>{card.title}</h2>
                <p>{card.description}</p>
                <div className="feature-spacer" aria-hidden="true" />
                <div className="feature-card-footer">
                  <TileExample type={card.example} />
                  <Link
                    className={card.buttonClassName}
                    href={card.to}
                    aria-label={`${t("home.openLabel")} ${card.title}`}
                  >
                    {card.arrow ? (
                      <span
                        className="card-cta"
                        aria-hidden="true"
                        style={card.arrowColor ? { ['--cta-color']: card.arrowColor } : undefined}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M5 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    ) : null}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
