import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import Stripe from "stripe";

import { PROJECT_ROOT, renderCreditsPriceId, serverSecret, stripeSecretKey } from "./config.js";
import { firestore, firestoreConfigured } from "./firestore.js";
import { ApiError } from "./http.js";

export const RENDER_CREDIT_BUNDLE_SIZE = 10;
export const RENDER_CREDIT_PRICE_CENTS = 500;
export const RENDER_CREDIT_CURRENCY = "eur";
export const RENDER_CREDIT_COLLECTION = "render_credit_codes";
export const RENDER_CREDIT_BUNDLE_COLLECTION = "render_credit_bundles";

const LOCAL_STORE_PATH = path.join(PROJECT_ROOT, ".sandbox", "render-credits.json");
const PDF_LOGO_PATH = path.join(process.cwd(), "public", "LeLogo.svg");
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
  const secret = serverSecret("RENDER_CREDIT_SECRET_FILE", "RENDER_CREDIT_SECRET") ||
    serverSecret("RENDER_QUOTA_SECRET_FILE", "RENDER_QUOTA_SECRET");
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

export async function createRenderCreditCheckoutSession({ successUrl, cancelUrl, language = "en" }) {
  const deliveryLanguage = String(language).toLowerCase() === "de" ? "de" : "en";
  const metadata = {
    purchase_type: "render_credits",
    credit_count: String(RENDER_CREDIT_BUNDLE_SIZE),
    delivery_language: deliveryLanguage,
  };
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
  const codes = await issueRenderCreditBundle(session);
  const emailConfigured = Boolean(serverSecret("SENDGRID_API_KEY_FILE", "SENDGRID_API_KEY"));
  if (!emailConfigured && useLocalStore()) return true;

  const delivery = await reserveRenderCreditEmailDelivery(session.id, event.id);
  if (delivery === "sent") return true;
  if (delivery === "busy") throw new ApiError("Generation-code email delivery is already in progress.", 503);

  try {
    const { sendRenderCreditEmail } = await import("./renderCreditEmail.js");
    await sendRenderCreditEmail({
      recipient: String(session.customer_details?.email || session.customer_email || "").trim(),
      codes,
      language: session.metadata?.delivery_language,
    });
    await completeRenderCreditEmailDelivery(session.id, event.id);
  } catch (error) {
    await failRenderCreditEmailDelivery(session.id, event.id, error);
    throw error;
  }
  return true;
}

const EMAIL_DELIVERY_LEASE_MS = 5 * 60 * 1000;

async function reserveRenderCreditEmailDelivery(sessionId, eventId) {
  const now = new Date();
  const deliveryEventId = String(eventId || "unknown");
  if (useLocalStore()) {
    return mutateLocalStore((store) => {
      const bundle = store.bundles[sessionId];
      if (bundle?.email_sent_at) return "sent";
      const startedAt = Date.parse(bundle?.email_delivery_started_at || "");
      if (bundle?.email_delivery_status === "sending" && Number.isFinite(startedAt) && now.getTime() - startedAt < EMAIL_DELIVERY_LEASE_MS) {
        return "busy";
      }
      Object.assign(bundle, {
        email_delivery_status: "sending",
        email_delivery_event_id: deliveryEventId,
        email_delivery_started_at: now.toISOString(),
      });
      return "reserved";
    });
  }

  const database = firestore();
  const bundleRef = database.collection(RENDER_CREDIT_BUNDLE_COLLECTION).doc(sessionId);
  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(bundleRef);
    const bundle = snapshot.data() || {};
    if (bundle.email_sent_at) return "sent";
    const startedAt = bundle.email_delivery_started_at?.toDate?.() || new Date(bundle.email_delivery_started_at || 0);
    if (bundle.email_delivery_status === "sending" && now.getTime() - startedAt.getTime() < EMAIL_DELIVERY_LEASE_MS) return "busy";
    transaction.update(bundleRef, {
      email_delivery_status: "sending",
      email_delivery_event_id: deliveryEventId,
      email_delivery_started_at: now,
    });
    return "reserved";
  });
}

async function completeRenderCreditEmailDelivery(sessionId, eventId) {
  const now = new Date();
  const deliveryEventId = String(eventId || "unknown");
  if (useLocalStore()) {
    return mutateLocalStore((store) => Object.assign(store.bundles[sessionId], {
      email_delivery_status: "sent",
      email_delivery_event_id: deliveryEventId,
      email_sent_at: now.toISOString(),
    }));
  }
  return firestore().collection(RENDER_CREDIT_BUNDLE_COLLECTION).doc(sessionId).update({
    email_delivery_status: "sent",
    email_delivery_event_id: deliveryEventId,
    email_sent_at: now,
  });
}

async function failRenderCreditEmailDelivery(sessionId, eventId, error) {
  const failure = {
    email_delivery_status: "failed",
    email_delivery_event_id: String(eventId || "unknown"),
    email_delivery_failed_at: new Date(),
    email_delivery_error: String(error?.message || error).slice(0, 500),
  };
  if (useLocalStore()) {
    return mutateLocalStore((store) => Object.assign(store.bundles[sessionId], {
      ...failure,
      email_delivery_failed_at: failure.email_delivery_failed_at.toISOString(),
    }));
  }
  return firestore().collection(RENDER_CREDIT_BUNDLE_COLLECTION).doc(sessionId).update(failure);
}

function pdfEscape(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function svgAttribute(attributes, name) {
  return attributes.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1] || "";
}

function svgLogoPdfCommands(svg, { x, y, size }) {
  const viewBox = svg.match(/viewBox="[^"]*?([\d.]+)\s+([\d.]+)"/);
  const width = Number(viewBox?.[1] || 900);
  const height = Number(viewBox?.[2] || 900);
  const scaleX = (value) => x + Number(value) * size / width;
  const scaleY = (value) => y + (height - Number(value)) * size / height;
  const commands = ["q", "1 1 1 rg", "0 0 0 RG", `${(10 * size / width).toFixed(3)} w`];

  const circle = svg.match(/<circle\b([^>]*)\/>/);
  if (circle) {
    const cx = scaleX(svgAttribute(circle[1], "cx"));
    const cy = scaleY(svgAttribute(circle[1], "cy"));
    const radius = Number(svgAttribute(circle[1], "r")) * size / width;
    const control = radius * 0.5522847498;
    commands.push(
      `${cx + radius} ${cy} m`,
      `${cx + radius} ${cy + control} ${cx + control} ${cy + radius} ${cx} ${cy + radius} c`,
      `${cx - control} ${cy + radius} ${cx - radius} ${cy + control} ${cx - radius} ${cy} c`,
      `${cx - radius} ${cy - control} ${cx - control} ${cy - radius} ${cx} ${cy - radius} c`,
      `${cx + control} ${cy - radius} ${cx + radius} ${cy - control} ${cx + radius} ${cy} c`,
      "B",
    );
  }

  for (const polygon of svg.matchAll(/<polygon\b([^>]*)\/>/g)) {
    const points = svgAttribute(polygon[1], "points")
      .trim()
      .split(/\s+/)
      .map((point) => point.split(",").map(Number));
    if (points.length < 3) continue;
    commands.push(`${scaleX(points[0][0])} ${scaleY(points[0][1])} m`);
    for (const [pointX, pointY] of points.slice(1)) {
      commands.push(`${scaleX(pointX)} ${scaleY(pointY)} l`);
    }
    commands.push("h", "B");
  }

  commands.push("Q");
  return commands.join("\n");
}

export function buildRenderCreditsPdf(codes) {
  return buildLocalizedRenderCreditsPdf(codes, "en");
}

const PDF_COPY = {
  en: {
    title: "Aperiodos generation codes",
    product: "10 single-use pattern generations - EUR 5.00",
    instructions: "Paste one code after your free daily generations are used. Tick it after use.",
    note: "Codes do not expire. Each code can be redeemed once.",
    createdBy: "CREATED BY",
  },
  de: {
    title: "Aperiodos Generierungscodes",
    product: "10 einmalig nutzbare Mustergenerierungen - EUR 5,00",
    instructions: "Nach dem kostenlosen Tageslimit einen Code einsetzen und danach abhaken.",
    note: "Codes verfallen nicht. Jeder Code kann einmal verwendet werden.",
    createdBy: "ERSTELLT VON",
  },
};

export function buildLocalizedRenderCreditsPdf(codes, language = "en") {
  const copy = PDF_COPY[language] || PDF_COPY.en;
  const checkboxObjectStart = 8;
  const checkboxObjectIds = codes.map((_, index) => checkboxObjectStart + index);
  const uncheckedAppearanceObjectId = checkboxObjectStart + codes.length;
  const checkedAppearanceObjectId = uncheckedAppearanceObjectId + 1;
  const logoCommands = svgLogoPdfCommands(readFileSync(PDF_LOGO_PATH, "utf8"), {
    x: 64,
    y: 58,
    size: 58,
  });
  const lines = [
    { text: copy.title, size: 20, y: 790, font: "F2" },
    { text: copy.product, size: 11, y: 765 },
    { text: copy.instructions, size: 10, y: 742 },
    ...codes.map((code, index) => ({ text: code, size: 14, x: 88, y: 700 - index * 48 })),
    { text: copy.note, size: 9, y: 190 },
    { text: copy.createdBy, size: 8, x: 140, y: 97 },
    { text: "Trainvent", size: 17, x: 140, y: 76, font: "F2" },
  ];
  const textCommands = lines
    .map(({ text, size, x = 64, y, font = "F1" }) =>
      `BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(text)}) Tj ET`)
    .join("\n");
  const stream = `${textCommands}\n0.75 w 64 148 m 531 148 l S\n${logoCommands}`;
  const checkboxObjects = codes.map((_, index) => {
    const baseline = 700 - index * 48;
    return `<< /Type /Annot /Subtype /Widget /FT /Btn /T (generation_code_${index + 1}) /F 4 /Rect [64 ${baseline - 3} 78 ${baseline + 11}] /V /Off /AS /Off /MK << /BC [0 0 0] /BG [1 1 1] >> /BS << /W 1 /S /S >> /AP << /N << /Off ${uncheckedAppearanceObjectId} 0 R /Yes ${checkedAppearanceObjectId} 0 R >> >> >>`;
  });
  const uncheckedAppearance = "q 1 1 1 rg 0 0 0 RG 1 w 0.5 0.5 13 13 re B Q";
  const checkedAppearance = "q 1 1 1 rg 0 0 0 RG 1 w 0.5 0.5 13 13 re B 1.6 w 3 7 m 6 4 l 11 10 l S Q";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R /AcroForm 7 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R /Annots [${checkboxObjectIds.map((id) => `${id} 0 R`).join(" ")}] >>`,
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Fields [${checkboxObjectIds.map((id) => `${id} 0 R`).join(" ")}] /NeedAppearances false >>`,
    ...checkboxObjects,
    `<< /Type /XObject /Subtype /Form /BBox [0 0 14 14] /Resources << >> /Length ${Buffer.byteLength(uncheckedAppearance)} >>\nstream\n${uncheckedAppearance}\nendstream`,
    `<< /Type /XObject /Subtype /Form /BBox [0 0 14 14] /Resources << >> /Length ${Buffer.byteLength(checkedAppearance)} >>\nstream\n${checkedAppearance}\nendstream`,
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
