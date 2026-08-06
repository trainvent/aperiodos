const REFERENCES = {
  de: [
    {
      label: "Trainvent",
      url: "https://next.trainvent.com/",
    },
    {
      label: "Hat-Monokachel Entdeckungsseite",
      url: "https://cs.uwaterloo.ca/~csk/hat/",
    },
    {
      label: "Spectre Informationsseite",
      url: "https://cs.uwaterloo.ca/~csk/spectre/",
    },
    {
      label: "Einstein-Generator Inspiration",
      url: "https://github.com/asmoly/Einstein_Tile_Generator",
    },
    {
      label: "Spectre-Generator Inspiration",
      url: "https://github.com/necocen/spectre",
    },
    {
      label: "OpenAI wurde ",
      url: "https://openai.com/",
    },
  ],
  en: [
    {
      label: "Trainvent",
      url: "https://next.trainvent.com/",
    },
    {
      label: "Hat monotile reference page",
      url: "https://cs.uwaterloo.ca/~csk/hat/h7h8.html",
    },
    {
      label: "Spectre project page",
      url: "https://cs.uwaterloo.ca/~csk/spectre/",
    },
    {
      label: "Earlier Einstein inspiration repo",
      url: "https://github.com/asmoly/Einstein_Tile_Generator",
    },
    {
      label: "necocen/spectre",
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
      "Aperiodos ist ein Trainvent-Subservice für aperiodische Monokacheln, Bildgenerierung und Browser-Experimente. Die Seite fokussiert derzeit Monokacheln, mit Plänen für weitere aperiodische Muster und Penrose-Muster.",
    references: REFERENCES.de,
    credits:
      "Dieser Trainvent-Subservice baut auf Papers, mathematischen Referenzen und öffentlichen Open-Source-Experimenten auf, um zu zeigen, wie diese Muster gerendert und präsentiert werden können.",
    technical_realizations:
      "OpenAI hat bei technischer Realisierung, Architekturplanung, Refactors, API-Formgebung und Frontend/Backend-Integration geholfen.",
    notes:
      "Der Rust-basierte Spectre-Renderer liegt in src/generators/spectre. Einstein und Spectre teilen eine visuelle Sprache im Trainvent-Kontext.",
  },
  en: {
    title: "About Aperiodos",
    summary:
      "Aperiodos is a Trainvent subservice for aperiodic monotiles, image generation, and browser experiments. The site currently centers on monotiles, with plans to expand into other aperiodic patterns and Penrose tilings.",
    references: REFERENCES.en,
    credits:
      "This Trainvent subservice builds on papers, mathematical references, and public open-source experiments to show how these patterns can be rendered and presented.",
    technical_realizations:
      "OpenAI helped with technical implementation, architecture planning, refactors, API shaping, and frontend/backend integration.",
    notes:
      "The Rust-based Spectre renderer lives in src/generators/spectre. Einstein and Spectre share a visual language in the Trainvent context.",
  },
};

export const ABOUT_CONTENT = ABOUT_CONTENT_BY_LANGUAGE.en;

export function getAboutContent(language) {
  return ABOUT_CONTENT_BY_LANGUAGE[language === "en" ? "en" : "de"];
}
