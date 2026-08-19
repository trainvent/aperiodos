import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import AboutPage from "./features/about/AboutPage";
import DonatePage from "./features/donations/DonatePage";
import SponsorsPage from "./features/donations/SponsorsPage";
import EinsteinPage from "./features/generators/EinsteinPage";
import PenrosePage from "./features/generators/PenrosePage";
import SpectrePage from "./features/generators/SpectrePage";
import HomePage from "./features/home/HomePage";
import RenderCreditsPage from "./features/renderCredits/RenderCreditsPage";

export default function App() {
  const { t, i18n } = useTranslation("common");
  const router = useRouter();
  const language = i18n.resolvedLanguage === "en" ? "en" : "de";
  const currentPath = normalizePath(router.asPath);
  const pageTitle = getPageTitle(currentPath, t);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <header className="topbar">
        <div className="brand-heading">
          <Link className="brand" href="/">
            <img className="brand-mark" src="/custom-pattern_1024.png" alt="" />
            <span className="brand-copy">Aperiodos</span>
          </Link>
          {currentPath !== "/" ? (
            <>
              <span className="brand-separator" aria-hidden="true" />
              <h1 className="page-title">{pageTitle}</h1>
            </>
          ) : null}
        </div>
        <button
          className={`mobile-menu-toggle${mobileMenuOpen ? " open" : ""}`}
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="primary-navigation"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className={`topbar-right${mobileMenuOpen ? " open" : ""}`} id="primary-navigation">
          <nav className="topnav" onClick={() => setMobileMenuOpen(false)}>
            <TopNavLink to="/">{t("nav.home")}</TopNavLink>
            <TopNavLink to="/einstein">Einstein</TopNavLink>
            <TopNavLink to="/spectre">Spectre</TopNavLink>
            <TopNavLink to="/penrose">Penrose</TopNavLink>
            <TopNavLink to="/generation-codes">
              <span className="shop-nav-label">
                <svg
                  className="shop-nav-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M7 7V6a5 5 0 0 1 10 0v1h2.2l1 14H3.8l1-14H7Zm2 0h6V6a3 3 0 0 0-6 0v1Z" />
                </svg>
                {t("nav.codes")}
              </span>
            </TopNavLink>
            <TopNavLink to="/sponsors">
              <span className="sponsors-nav-label">
                <svg
                  className="sponsors-nav-heart"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.7 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
                </svg>
                {t("nav.sponsors")}
              </span>
            </TopNavLink>
            <TopNavLink to="/about">{t("nav.about")}</TopNavLink>
          </nav>
          <div className="lang-switch" role="group" aria-label={t("language.label")}>
            <span className="lang-switch-control">
              <button
                className="lang-toggle"
                type="button"
                onClick={() => i18n.changeLanguage(language === "de" ? "en" : "de")}
                aria-label="Toggle language"
              >
                <span className="lang-flag" aria-hidden="true">{language === "de" ? "🇩🇪" : "🇬🇧"}</span>
                <span className="lang-code">{language.toUpperCase()}</span>
              </button>
            </span>
          </div>
        </div>
      </header>

      <main className="page">
        <CurrentPage path={router.asPath} />
      </main>

      <footer className="footer">
        <div>
          {t("footer.lead")}{" "}
          <a href="https://next.trainvent.com/" target="_blank" rel="noreferrer">
            Trainvent
          </a>
        </div>
      </footer>
    </div>
  );
}

function TopNavLink({ to, children }) {
  const router = useRouter();
  const currentPath = normalizePath(router.asPath);
  const isActive = currentPath === to || (to !== "/" && currentPath.startsWith(`${to}/`));
  return (
    <Link className={`navlink${isActive ? " active" : ""}`} href={to}>
      {children}
    </Link>
  );
}

function normalizePath(path) {
  const normalized = String(path || "/").split("?")[0].split("#")[0] || "/";
  return normalized.endsWith("/") && normalized !== "/" ? normalized.slice(0, -1) : normalized;
}

function getPageTitle(path, t) {
  switch (path) {
    case "/einstein":
      return t("generator.einstein.title");
    case "/spectre":
      return t("generator.spectre.title");
    case "/penrose":
      return t("generator.penrose.title");
    case "/generation-codes":
      return t("renderCredits.hero.title");
    case "/donate":
      return t("donate.hero.title");
    case "/sponsors":
      return t("sponsors.hero.title");
    case "/about":
      return t("about.hero.title");
    default:
      return t("home.hero.title");
  }
}

function CurrentPage({ path }) {
  switch (normalizePath(path)) {
    case "/donate":
      return <DonatePage />;
    case "/sponsors":
      return <SponsorsPage />;
    case "/einstein":
      return <EinsteinPage />;
    case "/spectre":
      return <SpectrePage />;
    case "/penrose":
      return <PenrosePage />;
    case "/generation-codes":
      return <RenderCreditsPage />;
    case "/about":
      return <AboutPage />;
    default:
      return <HomePage />;
  }
}
