import { donationServiceAvailable } from "../../../src/server/config.js";
import { resolvePublicAppUrl } from "../../../src/server/donations.js";
import { createRenderCreditCheckoutSession } from "../../../src/server/renderCredits.js";
import { handleApiError, methodNotAllowed } from "../../../src/server/http.js";

function safeReturnPath(value) {
  const path = String(value || "").trim();
  return /^\/(generation-codes|einstein|spectre|penrose)\/?$/.test(path) ? path.replace(/\/$/, "") || "/" : "/generation-codes";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!donationServiceAvailable()) return res.status(503).json({ error: "Stripe is not configured on this server." });
  try {
    const baseUrl = resolvePublicAppUrl(req);
    const returnPath = safeReturnPath(req.body?.return_path);
    const session = await createRenderCreditCheckoutSession({
      successUrl: `${baseUrl}${returnPath}?render_credits=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}${returnPath}?render_credits=cancelled`,
    });
    return res.status(200).json({ checkout_url: session.url, checkout_session_id: session.id });
  } catch (error) {
    return handleApiError(res, error);
  }
}
