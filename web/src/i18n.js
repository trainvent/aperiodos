import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import deCommon from "./locales/de/common.json";
import enCommon from "./locales/en/common.json";

const resources = {
  de: { common: deCommon },
  en: { common: enCommon }
};

i18n
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
    }
  });

export default i18n;
