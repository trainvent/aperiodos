import { donationServiceAvailable } from "../../../server/config.js";
import {
  recordSponsorFromCheckoutSession,
  retrieveCheckoutSession,
} from "../../../server/donations.js";
import { handleApiError, methodNotAllowed } from "../../../server/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }
  if (!donationServiceAvailable()) {
    return res.status(503).json({ error: "Donations are not configured on this server." });
  }
  try {
    const sessionId = String(req.body?.session_id || "").trim();
    if (!sessionId) {
      return res.status(400).json({ error: "Missing Stripe checkout session id." });
    }
    const session = await retrieveCheckoutSession(sessionId);
    const recorded = await recordSponsorFromCheckoutSession({ session });
    return res.status(200).json({ recorded: Boolean(recorded) });
  } catch (error) {
    return handleApiError(res, error);
  }
}
