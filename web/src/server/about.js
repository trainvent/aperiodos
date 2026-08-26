const REFERENCES = {
  de: [
    {
      label: "Trainvent",
      url: "https://next.trainvent.com/",
    },
    {
      label: "Die Hat-Kachel – Hintergrund und Entdeckung",
      url: "https://cs.uwaterloo.ca/~csk/hat/",
    },
    {
      label: "Die Spectre-Kachel – Hintergrund und Referenz",
      url: "https://cs.uwaterloo.ca/~csk/spectre/",
    },
    {
      label: "Two algorithms for randomly generating aperiodic tilings",
      url: "https://www.chiark.greenend.org.uk/~sgtatham/quasiblog/aperiodic-tilings/",
    },
    {
      label: "Einstein Tile Generator von asmoly",
      url: "https://github.com/asmoly/Einstein_Tile_Generator",
    },
    {
      label: "Spectre-Renderer von necocen",
      url: "https://github.com/necocen/spectre",
    },
    {
      label: "OpenAI",
      url: "https://openai.com/",
    },
  ],
  en: [
    {
      label: "Trainvent",
      url: "https://next.trainvent.com/",
    },
    {
      label: "The Hat tile – background and discovery",
      url: "https://cs.uwaterloo.ca/~csk/hat/h7h8.html",
    },
    {
      label: "The Spectre tile – background and reference",
      url: "https://cs.uwaterloo.ca/~csk/spectre/",
    },
    {
      label: "Two algorithms for randomly generating aperiodic tilings",
      url: "https://www.chiark.greenend.org.uk/~sgtatham/quasiblog/aperiodic-tilings/",
    },
    {
      label: "Einstein Tile Generator by asmoly",
      url: "https://github.com/asmoly/Einstein_Tile_Generator",
    },
    {
      label: "Spectre renderer by necocen",
      url: "https://github.com/necocen/spectre",
    },
    {
      label: "OpenAI",
      url: "https://openai.com/",
    },
  ],
};

const ABOUT_CONTENT_BY_LANGUAGE = {
  de: {
    title: "Über Aperiodos",
    summary:
      "Aperiodos ist ein experimentelles Werkzeug von Trainvent für aperiodische Kachelungen. Im Browser lassen sich Einstein-, Spectre- und Penrose-Muster erzeugen, anpassen und als Bilddateien exportieren.",
    references: REFERENCES.de,
    credits:
      "Die Generatoren basieren auf publizierter mathematischer Forschung und öffentlich zugänglichen Open-Source-Projekten. Die verlinkten Quellen dokumentieren wichtige Grundlagen und frühere Implementierungen.",
    technical_realizations:
      "OpenAI unterstützte die Entwicklung bei Softwarearchitektur, API-Design, Refactoring sowie bei der Integration von Benutzeroberfläche und Renderern.",
    notes:
      "Der Einstein-Generator wird in Python berechnet; die Spectre- und Penrose-Renderer sind in Rust umgesetzt. Eine Next.js-Anwendung führt die drei Werkzeuge in einer gemeinsamen Browseroberfläche zusammen.",
  },
  en: {
    title: "About Aperiodos",
    summary:
      "Aperiodos is an experimental Trainvent tool for exploring aperiodic tilings. You can generate, customize, and export Einstein, Spectre, and Penrose patterns directly in the browser.",
    references: REFERENCES.en,
    credits:
      "The generators build on published mathematical research and publicly available open-source projects. The links above document important source material and earlier implementations.",
    technical_realizations:
      "OpenAI supported development through software architecture, API design, refactoring, and the integration of the interface with the rendering engines.",
    notes:
      "The Einstein generator is implemented in Python, while the Spectre and Penrose renderers are written in Rust. A Next.js application brings all three tools together in a shared browser interface.",
  },
};

export const ABOUT_CONTENT = ABOUT_CONTENT_BY_LANGUAGE.en;

export function getAppVersion(environment = process.env) {
  const version = String(environment.APP_VERSION || "development").trim();
  return version || "development";
}

export function getAboutContent(language, environment = process.env) {
  return {
    ...ABOUT_CONTENT_BY_LANGUAGE[language === "en" ? "en" : "de"],
    version: getAppVersion(environment),
  };
}
