import { donationServiceAvailable } from "../../../src/server/config.js";
import {
  parseStripeEvent,
  recordSponsorFromEvent,
} from "../../../src/server/donations.js";
import { handleApiError, methodNotAllowed, readRawBody } from "../../../src/server/http.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }
  if (!donationServiceAvailable()) {
    return res.status(503).json({ error: "Stripe is not configured on this server." });
  }
  try {
    const rawBody = await readRawBody(req);
    const event = parseStripeEvent(rawBody, req.headers["stripe-signature"] || "");
    const recorded = await recordSponsorFromEvent(event);
    return res.status(200).json({ received: true, recorded: Boolean(recorded) });
  } catch (error) {
    return handleApiError(res, error);
  }
}
