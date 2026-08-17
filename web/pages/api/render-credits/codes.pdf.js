import { donationServiceAvailable } from "../../../src/server/config.js";
import { retrieveCheckoutSession } from "../../../src/server/donations.js";
import { buildLocalizedRenderCreditsPdf, issueRenderCreditBundle } from "../../../src/server/renderCredits.js";
import { handleApiError, methodNotAllowed } from "../../../src/server/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  if (!donationServiceAvailable()) return res.status(503).json({ error: "Stripe is not configured on this server." });
  try {
    const session = await retrieveCheckoutSession(req.query?.session_id);
    const codes = await issueRenderCreditBundle(session);
    const language = String(req.query?.lang || "").toLowerCase() === "de" ? "de" : "en";
    const pdf = buildLocalizedRenderCreditsPdf(codes, language);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="aperiodos-generation-codes.pdf"');
    res.setHeader("Content-Length", String(pdf.length));
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(pdf);
  } catch (error) {
    return handleApiError(res, error);
  }
}
