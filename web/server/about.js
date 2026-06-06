export const ABOUT_CONTENT = {
  title: "About Aperiodos",
  summary:
    "Aperiodos is a Trainvent subservice for aperiodic monotiles, image generation, and browser experiments. The site currently centers on monotiles, with plans to expand into other aperiodic patterns and Penrose tilings.",
  references: [
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
  credits:
    "This Trainvent subservice draws on papers, mathematical references, and public open-source experiments to explore how these tilings can be rendered and presented on the web.",
  technical_realizations:
    "OpenAI helped with technical realization work across the project, including architecture planning, refactors, API shaping, and frontend/backend integration support.",
  notes:
    "The Rust-based Spectre renderer lives in src/generators/spectre_rs. Einstein and Spectre share one visual language inside the broader Trainvent web presence.",
};
