import { renderSpectre } from "../../../src/server/renderers.js";
import { handleApiError, methodNotAllowed, sendBuffer } from "../../../src/server/http.js";
import { enforceRenderQuota } from "../../../src/server/renderQuota.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }
  try {
    await enforceRenderQuota(req, res);
    const rendered = await renderSpectre(req.body || {});
    return sendBuffer(res, rendered.buffer, rendered);
  } catch (error) {
    return handleApiError(res, error);
  }
}
