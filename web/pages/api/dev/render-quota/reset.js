import { methodNotAllowed } from "../../../../src/server/http.js";
import { resetLocalRenderQuota } from "../../../../src/server/renderQuota.js";

export default async function handler(req, res) {
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).json({ error: "Not found." });
  }
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    await resetLocalRenderQuota();
    return res.status(200).json({ reset: true });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Reset failed." });
  }
}
