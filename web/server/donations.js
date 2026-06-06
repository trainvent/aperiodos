import { Firestore } from "@google-cloud/firestore";
import Stripe from "stripe";

import {
  MAX_DONATION_CENTS,
  donationCurrency,
  minimumDonationCents,
  stripeSecretKey,
  stripeWebhookSecret,
} from "./config.js";
import { ApiError } from "./http.js";

let firestoreClient;
let warnedAboutFirestore = false;

function trimmedText(value, { maxLength, fallback = "" }) {
  const text = String(value || "").trim();
  if (!text) {
    return fallback;
  }
  return text.slice(0, maxLength);
}

function toBool(value, fallback = true) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function stripeClient() {
  const secretKey = stripeSecretKey();
  if (!secretKey) {
    throw new ApiError("Missing Stripe secret key.", 503);
  }
  return new Stripe(secretKey);
}

function firestoreConfigured() {
  if (String(process.env.FIRESTORE_DISABLED || "").trim().toLowerCase() === "1") {
    return false;
  }
  return Boolean(
    process.env.FIRESTORE_PROJECT_ID ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.K_SERVICE,
  );
}

function warnFirestoreSkipped() {
  if (warnedAboutFirestore) {
    return;
  }
  warnedAboutFirestore = true;
  console.warn("Firestore is not configured; sponsors are disabled for this local run.");
}

function firestore() {
  if (!firestoreConfigured()) {
    throw new ApiError("Firestore is not configured on this server.", 503);
  }
  if (!firestoreClient) {
    const projectId = process.env.FIRESTORE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || undefined;
    const databaseId = process.env.FIRESTORE_DATABASE_ID || "(default)";
    firestoreClient = new Firestore({ projectId, databaseId });
  }
  return firestoreClient;
}

export function buildCheckoutUrls(baseUrl, donatePath = "/donate") {
  const normalized = baseUrl.replace(/\/$/, "");
  return {
    successUrl: `${normalized}${donatePath}?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${normalized}${donatePath}?status=cancelled`,
  };
}

export function resolvePublicAppUrl(req) {
  const configured = String(process.env.PUBLIC_APP_URL || "").trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  const origin = String(req.headers.origin || "").trim();
  if (origin.startsWith("http://") || origin.startsWith("https://")) {
    return origin.replace(/\/$/, "");
  }
  const protocol = req.headers["x-forwarded-proto"] || "http";
  return `${protocol}://${req.headers.host}`.replace(/\/$/, "");
}

export function coerceDonationAmount(payload) {
  const minimumAmount = minimumDonationCents();
  const value = Number.parseInt(payload.amount_cents ?? minimumAmount, 10);
  if (!Number.isFinite(value)) {
    throw new ApiError("'amount_cents' must be an integer.");
  }
  if (value < minimumAmount) {
    throw new ApiError(`'amount_cents' must be at least ${minimumAmount}.`);
  }
  if (value > MAX_DONATION_CENTS) {
    throw new ApiError(`'amount_cents' must be at most ${MAX_DONATION_CENTS}.`);
  }
  return value;
}

export async function createDonationCheckoutSession({ amountCents, currency, donorName, donorMessage, isPublic, successUrl, cancelUrl }) {
  const stripe = stripeClient();
  const cleanName = trimmedText(donorName, { maxLength: 120, fallback: "Anonymous Sponsor" });
  const cleanMessage = trimmedText(donorMessage, { maxLength: 280 });
  const metadata = {
    donor_name: cleanName,
    donor_message: cleanMessage,
    is_public: isPublic ? "1" : "0",
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    submit_type: "donate",
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    customer_creation: "always",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: String(currency || donationCurrency()).toLowerCase(),
          unit_amount: Number(amountCents),
          product_data: {
            name: "Aperiodos Sponsor Donation",
          },
        },
      },
    ],
    payment_intent_data: {
      metadata,
      statement_descriptor_suffix: "Aperiodos".slice(0, 22),
    },
    metadata,
  });

  return {
    id: session.id,
    url: session.url,
  };
}

export async function retrieveCheckoutSession(checkoutSessionId) {
  const cleanSessionId = trimmedText(checkoutSessionId, { maxLength: 200 });
  if (!cleanSessionId) {
    throw new ApiError("Missing Stripe checkout session id.");
  }
  return stripeClient().checkout.sessions.retrieve(cleanSessionId);
}

export function parseStripeEvent(rawBody, signatureHeader) {
  const secret = stripeWebhookSecret();
  if (secret) {
    try {
      return stripeClient().webhooks.constructEvent(rawBody, signatureHeader, secret);
    } catch (error) {
      throw new ApiError("Invalid Stripe webhook signature.", 400);
    }
  }
  try {
    return JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new ApiError("Webhook payload is not valid JSON.", 400);
  }
}

export async function listPublicSponsors(limit = 100) {
  if (!firestoreConfigured()) {
    warnFirestoreSkipped();
    return [];
  }
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 500);
  let snapshot;
  try {
    snapshot = await firestore()
      .collection("sponsors")
      .where("is_public", "==", true)
      .orderBy("created_at", "desc")
      .limit(safeLimit)
      .get();
  } catch (error) {
    if (String(error?.message || "").includes("default credentials")) {
      warnFirestoreSkipped();
      return [];
    }
    throw error;
  }

  return snapshot.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      name: data.donor_name || "",
      amount_cents: Number(data.amount_cents || 0),
      currency: data.currency || "",
      message: data.message || "",
      created_at: data.created_at || "",
    };
  });
}

export async function recordSponsorFromEvent(event) {
  if (!firestoreConfigured()) {
    throw new ApiError("Firestore is not configured on this server.", 503);
  }
  const eventId = String(event?.id || "").trim();
  const eventType = String(event?.type || "");
  if (!eventId || !["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(eventType)) {
    return false;
  }
  if (await hasProcessedEvent(eventId)) {
    return false;
  }
  const session = event?.data?.object || {};
  return recordSponsorFromCheckoutSession({
    session,
    eventId,
    sessionId: String(session.id || "").trim(),
    createdTs: event.created,
  });
}

export async function recordSponsorFromCheckoutSession({ session, eventId = "", sessionId = "", createdTs } = {}) {
  if (!firestoreConfigured()) {
    throw new ApiError("Firestore is not configured on this server.", 503);
  }
  const resolvedSessionId = String(sessionId || session?.id || "").trim();
  if (!resolvedSessionId) {
    if (eventId) {
      await markEventProcessed(eventId);
    }
    return false;
  }

  const paymentStatus = String(session?.payment_status || "").toLowerCase();
  if (paymentStatus && paymentStatus !== "paid") {
    if (eventId) {
      await markEventProcessed(eventId);
    }
    return false;
  }

  const metadata = session?.metadata || {};
  const customerDetails = session?.customer_details || {};
  const donorName = trimmedText(metadata.donor_name || customerDetails.name, {
    maxLength: 120,
    fallback: "Anonymous Sponsor",
  });
  const donorMessage = trimmedText(metadata.donor_message, { maxLength: 280 });
  const amountCents = Number(session?.amount_total || 0);
  if (amountCents <= 0) {
    if (eventId) {
      await markEventProcessed(eventId);
    }
    return false;
  }

  const createdAt =
    typeof createdTs === "number"
      ? new Date(createdTs * 1000).toISOString().replace(/\.\d{3}Z$/, "+00:00")
      : new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");

  const sponsorRef = firestore().collection("sponsors").doc(resolvedSessionId);
  const existing = await sponsorRef.get();
  if (existing.exists) {
    if (eventId) {
      await markEventProcessed(eventId);
    }
    return false;
  }

  await sponsorRef.create({
    stripe_session_id: resolvedSessionId,
    stripe_event_id: eventId,
    donor_name: donorName,
    amount_cents: amountCents,
    currency: String(session?.currency || "eur").toLowerCase(),
    message: donorMessage,
    is_public: toBool(metadata.is_public, true),
    created_at: createdAt,
  });

  if (eventId) {
    await markEventProcessed(eventId);
  }
  return true;
}

async function hasProcessedEvent(eventId) {
  const doc = await firestore().collection("stripe_events").doc(eventId).get();
  return doc.exists;
}

async function markEventProcessed(eventId) {
  await firestore().collection("stripe_events").doc(eventId).set({
    created_at: new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00"),
  });
}
