import { donationServiceAvailable } from "../../../src/server/config.js";
import { retrieveCheckoutSession } from "../../../src/server/donations.js";
import { issueRenderCreditBundle } from "../../../src/server/renderCredits.js";
import { handleApiError, methodNotAllowed } from "../../../src/server/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!donationServiceAvailable()) return res.status(503).json({ error: "Stripe is not configured on this server." });
  try {
    const session = await retrieveCheckoutSession(req.body?.session_id);
    const codes = await issueRenderCreditBundle(session);
    return res.status(200).json({ codes });
  } catch (error) {
    return handleApiError(res, error);
  }
}
