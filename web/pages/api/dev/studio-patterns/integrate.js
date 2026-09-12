import { methodNotAllowed } from "../../../../src/server/http.js";
import { disintegrateStudioPattern, integrateStudioPattern } from "../../../../src/server/studioPatterns.js";

export default async function handler(req, res) {
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).json({ error: "Not found." });
  }
  if (!["POST", "DELETE"].includes(req.method)) {
    return methodNotAllowed(res, ["POST", "DELETE"]);
  }

  try {
    const result = req.method === "DELETE"
      ? await disintegrateStudioPattern(req.body?.id)
      : await integrateStudioPattern(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Integration failed." });
  }
}
