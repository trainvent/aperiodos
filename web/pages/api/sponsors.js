import { donationCurrency } from "../../server/config.js";
import { listPublicSponsors } from "../../server/donations.js";
import { handleApiError, methodNotAllowed } from "../../server/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }
  try {
    const sponsors = await listPublicSponsors(req.query.limit || "100");
    return res.status(200).json({
      sponsors,
      count: sponsors.length,
      currency: donationCurrency(),
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
