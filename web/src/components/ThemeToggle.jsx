import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  applyThemePreference,
  normalizeThemePreference,
  readThemePreference,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
} from "../lib/theme";

export default function ThemeToggle() {
  const { t } = useTranslation("common");
  const [preference, setPreference] = useState(() => {
    if (typeof document === "undefined") return "auto";
    return normalizeThemePreference(document.documentElement.dataset.themePreference || readThemePreference());
  });

  useEffect(() => {
    applyThemePreference(preference);
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    if (preference !== "auto") return undefined;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateFromBrowser = () => applyThemePreference("auto");
    media.addEventListener?.("change", updateFromBrowser);
    return () => media.removeEventListener?.("change", updateFromBrowser);
  }, [preference]);

  const currentIndex = THEME_PREFERENCES.indexOf(preference);
  const nextPreference = THEME_PREFERENCES[(currentIndex + 1) % THEME_PREFERENCES.length];
  const label = t("theme.toggle", {
    current: t(`theme.${preference}`),
    next: t(`theme.${nextPreference}`),
  });

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setPreference(nextPreference)}
      suppressHydrationWarning
    >
      <ThemeIcon />
    </button>
  );
}

function ThemeIcon() {
  return (
    <span className="theme-toggle-icons" aria-hidden="true">
      <svg className="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
      </svg>
      <svg className="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 15.2A8.4 8.4 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" />
      </svg>
      <svg className="theme-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path className="theme-toggle-auto-fill" d="M12 4a8 8 0 0 1 0 16Z" />
      </svg>
    </span>
  );
}
