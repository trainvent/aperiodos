import { renderEinstein } from "../../../src/server/renderers.js";
import { handleApiError, methodNotAllowed, sendBuffer } from "../../../src/server/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }
  try {
    const rendered = await renderEinstein(req.body || {});
    return sendBuffer(res, rendered.buffer, rendered);
  } catch (error) {
    return handleApiError(res, error);
  }
}
