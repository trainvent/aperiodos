import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";

import AboutPage from "./features/about/AboutPage";
import DonatePage from "./features/donations/DonatePage";
import SponsorsPage from "./features/donations/SponsorsPage";
import EinsteinPage from "./features/generators/EinsteinPage";
import PenrosePage from "./features/generators/PenrosePage";
import SpectrePage from "./features/generators/SpectrePage";
import HomePage from "./features/home/HomePage";

export default function App() {
  const { t, i18n } = useTranslation("common");
  const router = useRouter();
  const language = i18n.resolvedLanguage === "en" ? "en" : "de";

  return (
    <div className="shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <header className="topbar">
        <Link className="brand" href="/">
          <img className="brand-mark" src="/custom-pattern_1024.png" alt="" />
          <span className="brand-copy">Aperiodos</span>
        </Link>
        <div className="topbar-right">
          <nav className="topnav">
            <TopNavLink to="/">{t("nav.home")}</TopNavLink>
            <TopNavLink to="/einstein">Einstein</TopNavLink>
            <TopNavLink to="/spectre">Spectre</TopNavLink>
            <TopNavLink to="/penrose">Penrose</TopNavLink>
            <TopNavLink to="/donate">{t("nav.sponsors")}</TopNavLink>
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
    case "/about":
      return <AboutPage />;
    default:
      return <HomePage />;
  }
}
