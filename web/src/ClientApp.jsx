import React, { useEffect } from "react";

import i18n from "./i18n";
import App from "./App";

export default function ClientApp() {
  useEffect(() => {
    const savedLanguage = window.localStorage.getItem("aperiodos-lang");
    const browserLanguage = window.navigator.language?.toLowerCase().startsWith("en") ? "en" : "de";
    const language = savedLanguage === "en" || savedLanguage === "de" ? savedLanguage : browserLanguage;
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
