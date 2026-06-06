import { ABOUT_CONTENT } from "../../server/about.js";
import { methodNotAllowed } from "../../server/http.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }
  return res.status(200).json(ABOUT_CONTENT);
}
