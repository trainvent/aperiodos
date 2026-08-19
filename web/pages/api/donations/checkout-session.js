import { donationServiceAvailable } from "../../../src/server/config.js";
import {
  buildCheckoutUrls,
  coerceDonationAmount,
  coerceDonationCurrency,
  createDonationCheckoutSession,
  resolvePublicAppUrl,
} from "../../../src/server/donations.js";
import { handleApiError, methodNotAllowed } from "../../../src/server/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }
  if (!donationServiceAvailable()) {
    return res.status(503).json({ error: "Donations are not configured on this server." });
  }
  try {
    const payload = req.body || {};
    const amountCents = coerceDonationAmount(payload);
    const currency = coerceDonationCurrency(payload.currency);
    const returnPath = payload.return_path === "/sponsors" ? "/sponsors" : "/donate";
    const checkoutUrls = buildCheckoutUrls(resolvePublicAppUrl(req), returnPath);
    const session = await createDonationCheckoutSession({
      amountCents,
      currency,
      donorName: payload.name || "",
      donorMessage: payload.message || "",
      isPublic: true,
      successUrl: checkoutUrls.successUrl,
      cancelUrl: checkoutUrls.cancelUrl,
    });
    return res.status(200).json({
      checkout_url: session.url,
      checkout_session_id: session.id,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
