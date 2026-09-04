import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import ThemeToggle from "./components/ThemeToggle";
import AboutPage from "./features/about/AboutPage";
import EinsteinPage from "./features/generators/EinsteinPage";
import PenrosePage from "./features/generators/PenrosePage";
import SpectrePage from "./features/generators/SpectrePage";
import HomePage from "./features/home/HomePage";
import RenderCreditsPage from "./features/renderCredits/RenderCreditsPage";
import SponsorsPage from "./features/sponsors/SponsorsPage";
import StudioPage from "./features/studio/StudioPage";

export default function App() {
  const { t, i18n } = useTranslation("common");
  const router = useRouter();
  const language = ["de", "en", "el"].includes(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : "de";
  const currentPath = normalizePath(router.asPath);
  const pageTitle = getPageTitle(currentPath, t);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("aperiodos-lang", language);
  }, [language]);

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
            <TopNavLink to="/studio">
              <span className="studio-nav-label">
                <svg className="studio-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m14.2 4.1 5.7 5.7-8.7 8.7-4.5.9.9-4.5 6.6-6.6Z" />
                  <path d="m12.5 5.8 5.7 5.7M7.6 14.9l3.5 3.5" />
                  <path d="M5.2 18.8c-1.3.4-2.1 1.2-2.1 2.1 0 .6.6 1 1.5 1 1.7 0 2.8-1.1 3.1-2.4" />
                </svg>
                {t("nav.studio")}
              </span>
            </TopNavLink>
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
          <div className="global-controls">
            <ThemeToggle />
            <div className="lang-switch">
              <span className="lang-switch-control">
                <span className="lang-flag" aria-hidden="true">{LANGUAGES[language].flag}</span>
                <select
                  className="lang-select"
                  id="language-select"
                  value={language}
                  onChange={(event) => i18n.changeLanguage(event.target.value)}
                  aria-label={t("language.label")}
                >
                  {Object.entries(LANGUAGES).map(([code, { label }]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </span>
            </div>
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

const LANGUAGES = {
  de: { flag: "🇩🇪", label: "Deutsch" },
  en: { flag: "🇬🇧", label: "English" },
  el: { flag: "🇬🇷", label: "Ελληνικά" }
};

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
    case "/studio":
      return t("studio.hero.pageTitle");
    case "/generation-codes":
      return t("renderCredits.hero.title");
    case "/donate":
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
    case "/sponsors":
      return <SponsorsPage />;
    case "/einstein":
      return <EinsteinPage />;
    case "/spectre":
      return <SpectrePage />;
    case "/penrose":
      return <PenrosePage />;
    case "/studio":
      return <StudioPage />;
    case "/generation-codes":
      return <RenderCreditsPage />;
    case "/about":
      return <AboutPage />;
    default:
      return <HomePage />;
  }
}
