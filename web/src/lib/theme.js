export const THEME_STORAGE_KEY = "aperiodos-theme";
export const THEME_PREFERENCES = ["auto", "light", "dark"];

export function normalizeThemePreference(value) {
  return THEME_PREFERENCES.includes(value) ? value : "auto";
}

export function resolveTheme(preference, prefersDark) {
  return preference === "auto" ? (prefersDark ? "dark" : "light") : preference;
}

export function readThemePreference() {
  if (typeof window === "undefined") return "auto";
  return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
}

export function applyThemePreference(preference) {
  if (typeof document === "undefined") return "light";
  const normalized = normalizeThemePreference(preference);
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  const resolved = resolveTheme(normalized, prefersDark);
  document.documentElement.dataset.themePreference = normalized;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}
