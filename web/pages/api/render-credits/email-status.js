import { getRenderCreditEmailDeliveryStatus } from "../../../src/server/renderCredits.js";
import { handleApiError, methodNotAllowed } from "../../../src/server/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const status = await getRenderCreditEmailDeliveryStatus(req.query?.session_id);
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({ status });
  } catch (error) {
    return handleApiError(res, error);
  }
}
