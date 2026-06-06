import { getAboutContent } from "../../src/server/about.js";
import { methodNotAllowed } from "../../src/server/http.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }
  const language = Array.isArray(req.query.lang) ? req.query.lang[0] : req.query.lang;
  return res.status(200).json(getAboutContent(language));
}
