import { createHmac } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import Stripe from "stripe";

import { PROJECT_ROOT, renderCreditsPriceId, stripeSecretKey } from "./config.js";
import { firestore, firestoreConfigured } from "./firestore.js";
import { ApiError } from "./http.js";

export const RENDER_CREDIT_BUNDLE_SIZE = 10;
export const RENDER_CREDIT_PRICE_CENTS = 500;
export const RENDER_CREDIT_CURRENCY = "eur";
export const RENDER_CREDIT_COLLECTION = "render_credit_codes";
export const RENDER_CREDIT_BUNDLE_COLLECTION = "render_credit_bundles";

const LOCAL_STORE_PATH = path.join(PROJECT_ROOT, ".sandbox", "render-credits.json");
const LOCAL_DEVELOPMENT_SECRET = "aperiodos-local-render-credit-secret";
let localStoreQueue = Promise.resolve();

function stripeClient() {
  const key = stripeSecretKey();
  if (!key) throw new ApiError("Stripe is not configured on this server.", 503);
  return new Stripe(key);
}

function useLocalStore() {
  return String(process.env.RENDER_QUOTA_STORE || "").trim().toLowerCase() === "local";
}

function creditSecret() {
  const secret = String(process.env.RENDER_CREDIT_SECRET || process.env.RENDER_QUOTA_SECRET || "");
  const resolved = secret || (useLocalStore() ? LOCAL_DEVELOPMENT_SECRET : "");
  if (resolved.length < 32) {
    throw new ApiError("Render credits are not configured on this server.", 503);
  }
  return resolved;
}

async function readLocalStore() {
  try {
    const parsed = JSON.parse(await fs.readFile(LOCAL_STORE_PATH, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : { bundles: {}, codes: {} };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return { bundles: {}, codes: {} };
  }
}

async function mutateLocalStore(operation) {
  const pending = localStoreQueue.then(async () => {
    const store = await readLocalStore();
    store.bundles ||= {};
    store.codes ||= {};
    const result = await operation(store);
    await fs.mkdir(path.dirname(LOCAL_STORE_PATH), { recursive: true });
    await fs.writeFile(LOCAL_STORE_PATH, `${JSON.stringify(store, null, 2)}\n`);
    return result;
  });
  localStoreQueue = pending.catch(() => undefined);
  return pending;
}

export function normalizeRenderCreditCode(value) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^AP[0-9A-F]{20}$/.test(compact) ? compact : "";
}

export function hashRenderCreditCode(value) {
  const code = normalizeRenderCreditCode(value);
  if (!code) return "";
  return createHmac("sha256", creditSecret()).update(code).digest("hex");
}

function formatCode(compact) {
  return compact.match(/.{1,4}/g).join("-");
}

export function deriveRenderCreditCodes(sessionId) {
  const cleanSessionId = String(sessionId || "").trim();
  if (!cleanSessionId) throw new ApiError("Missing Stripe checkout session id.");
  return Array.from({ length: RENDER_CREDIT_BUNDLE_SIZE }, (_, index) => {
    const digest = createHmac("sha256", creditSecret())
      .update(`render-credit:${cleanSessionId}:${index}`)
      .digest("hex")
      .slice(0, 20)
      .toUpperCase();
    return formatCode(`AP${digest}`);
  });
}

function validatePaidCreditSession(session) {
  if (String(session?.payment_status || "").toLowerCase() !== "paid") {
    throw new ApiError("The checkout session has not been paid.", 402);
  }
  if (session?.metadata?.purchase_type !== "render_credits") {
    throw new ApiError("This checkout session is not for render credits.");
  }
  if (Number(session?.amount_total || 0) !== RENDER_CREDIT_PRICE_CENTS ||
      String(session?.currency || "").toLowerCase() !== RENDER_CREDIT_CURRENCY) {
    throw new ApiError("The checkout session does not match the render credit product.", 400);
  }
}

export async function createRenderCreditCheckoutSession({ successUrl, cancelUrl }) {
  const metadata = { purchase_type: "render_credits", credit_count: String(RENDER_CREDIT_BUNDLE_SIZE) };
  const configuredPriceId = renderCreditsPriceId();
  const session = await stripeClient().checkout.sessions.create({
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    line_items: configuredPriceId
      ? [{ quantity: 1, price: configuredPriceId }]
      : [{
          quantity: 1,
          price_data: {
            currency: RENDER_CREDIT_CURRENCY,
            unit_amount: RENDER_CREDIT_PRICE_CENTS,
            product_data: { name: `${RENDER_CREDIT_BUNDLE_SIZE} Aperiodos generation codes` },
          },
        }],
    payment_intent_data: { metadata, statement_descriptor_suffix: "Aperiodos" },
    metadata,
  });
  return { id: session.id, url: session.url };
}

export async function issueRenderCreditBundle(session) {
  validatePaidCreditSession(session);
  const sessionId = String(session.id || "").trim();
  const codes = deriveRenderCreditCodes(sessionId);
  const createdAt = new Date().toISOString();

  if (useLocalStore()) {
    await mutateLocalStore((store) => {
      if (store.bundles[sessionId]) return;
      store.bundles[sessionId] = { created_at: createdAt, count: codes.length };
      for (const code of codes) {
        store.codes[hashRenderCreditCode(code)] = { session_id: sessionId, used: false, created_at: createdAt };
      }
    });
    return codes;
  }

  if (!firestoreConfigured()) throw new ApiError("Render credit storage is not configured on this server.", 503);
  const database = firestore();
  const bundleRef = database.collection(RENDER_CREDIT_BUNDLE_COLLECTION).doc(sessionId);
  await database.runTransaction(async (transaction) => {
    const existing = await transaction.get(bundleRef);
    if (existing.exists) return;
    transaction.create(bundleRef, { stripe_session_id: sessionId, count: codes.length, created_at: new Date() });
    for (const code of codes) {
      transaction.create(database.collection(RENDER_CREDIT_COLLECTION).doc(hashRenderCreditCode(code)), {
        stripe_session_id: sessionId,
        used: false,
        created_at: new Date(),
      });
    }
  });
  return codes;
}

export async function fulfillRenderCreditsFromEvent(event) {
  if (!event || !["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    return false;
  }
  const session = event.data?.object;
  if (session?.metadata?.purchase_type !== "render_credits") return false;
  if (String(session.payment_status || "").toLowerCase() !== "paid") return false;
  await issueRenderCreditBundle(session);
  return true;
}

function pdfEscape(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function buildRenderCreditsPdf(codes) {
  const lines = [
    { text: "Aperiodos generation codes", size: 20, y: 790 },
    { text: "10 single-use pattern generations - EUR 5.00", size: 11, y: 765 },
    { text: "Paste one code after your free daily generations are used. Tick it after use.", size: 10, y: 742 },
    ...codes.map((code, index) => ({ text: `[  ]   ${code}`, size: 14, y: 700 - index * 48 })),
    { text: "Codes do not expire. Each code can be redeemed once.", size: 9, y: 190 },
  ];
  const stream = lines
    .map(({ text, size, y }) => `BT /F1 ${size} Tf 64 ${y} Td (${pdfEscape(text)}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

export async function consumeLocalRenderCredit(codeHash) {
  if (!codeHash) return false;
  return mutateLocalStore((store) => {
    const credit = store.codes[codeHash];
    if (!credit || credit.used) return false;
    credit.used = true;
    credit.used_at = new Date().toISOString();
    return true;
  });
}

export function renderCreditDocumentRef(database, codeHash) {
  return codeHash ? database.collection(RENDER_CREDIT_COLLECTION).doc(codeHash) : null;
}
