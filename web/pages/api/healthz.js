import { methodNotAllowed } from "../../src/server/http.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }
  return res.status(200).json({ ok: true });
}
