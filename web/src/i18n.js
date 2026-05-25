import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import deCommon from "./locales/de/common.json";
import enCommon from "./locales/en/common.json";

const resources = {
  de: { common: deCommon },
  en: { common: enCommon }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "de",
    lng: "de",
    supportedLngs: ["de", "en"],
    defaultNS: "common",
    ns: ["common"],
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "aperiodos-lang"
    }
  });

export default i18n;
