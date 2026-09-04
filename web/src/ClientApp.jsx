import React, { useEffect } from "react";

import i18n from "./i18n";
import App from "./App";

export default function ClientApp() {
  useEffect(() => {
    const savedLanguage = window.localStorage.getItem("aperiodos-lang");
    const browserLanguage = window.navigator.language?.toLowerCase().split("-")[0];
    const language = ["de", "en", "el"].includes(savedLanguage)
      ? savedLanguage
      : ["de", "en", "el"].includes(browserLanguage) ? browserLanguage : "de";
    if (i18n.resolvedLanguage !== language) {
      void i18n.changeLanguage(language);
    }
  }, []);

  return (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
