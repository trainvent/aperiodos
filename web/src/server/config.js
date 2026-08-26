import fs from "node:fs";
import path from "node:path";

export const WEB_ROOT = process.cwd();
export const PROJECT_ROOT = path.basename(WEB_ROOT) === "web" ? path.resolve(WEB_ROOT, "..") : WEB_ROOT;
export const SRC_DIR = path.join(PROJECT_ROOT, "src");
export const GENERATORS_DIR = path.join(SRC_DIR, "generators");

export const DEFAULT_HTTP_WIDTH = 1024;
export const DEFAULT_HTTP_HEIGHT = 1024;
export const MAX_IMAGE_DIMENSION = 6000;
export const MAX_ITERATIONS = 6;
export const MAX_SPECTRE_ITERATIONS = 8;
export const MAX_PENROSE_ITERATIONS = 10;
export const DEFAULT_SCALE = 100;
export const MAX_SCALE = 1000;
export const EINSTEIN_SCALE_NORMALIZATION = 10.0 / DEFAULT_SCALE;
export const SPECTRE_SCALE_NORMALIZATION = 8.0 / DEFAULT_SCALE;
export const PENROSE_SCALE_NORMALIZATION = 20.0 / DEFAULT_SCALE;
export const P1_SCALE_NORMALIZATION = 10.0 / DEFAULT_SCALE;

export const DEFAULT_COLORS = ["black", "seagreen", "white", "sandybrown", "gold"];
export const DEFAULT_FOUR_COLORS = ["seagreen", "sienna", "goldenrod", "midnightblue"];
export const DEFAULT_ITERATIONS = 5;

export const DEFAULT_DONATION_CURRENCY = "eur";
export const DONATION_CURRENCIES = ["eur", "usd", "gbp"];
export const DEFAULT_MIN_DONATION_CENTS = 100;
export const MAX_DONATION_CENTS = 500_000;

export const ALLOWED_EINSTEIN_FORMATS = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
};

export const ALLOWED_SPECTRE_FORMATS = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
};

export const ALLOWED_PENROSE_FORMATS = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
};

export function donationCurrency() {
  const configured = (process.env.DONATION_CURRENCY || DEFAULT_DONATION_CURRENCY).trim().toLowerCase();
  return DONATION_CURRENCIES.includes(configured) ? configured : DEFAULT_DONATION_CURRENCY;
}

export function minimumDonationCents() {
  const parsed = Number.parseInt(process.env.MIN_DONATION_CENTS || String(DEFAULT_MIN_DONATION_CENTS), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MIN_DONATION_CENTS;
  }
  return Math.max(50, Math.min(parsed, MAX_DONATION_CENTS));
}

export function stripeMode() {
  return (process.env.STRIPE_MODE || "live").trim().toLowerCase() || "live";
}

export function serverSecret(fileEnvironmentName, valueEnvironmentName) {
  const filePath = String(process.env[fileEnvironmentName] || "").trim();
  if (filePath) {
    try {
      return fs.readFileSync(filePath, "utf8").trim();
    } catch (error) {
      throw new Error(`Unable to read configured secret file '${fileEnvironmentName}'.`, { cause: error });
    }
  }
  return String(process.env[valueEnvironmentName] || "").trim();
}

export function stripeSecretKey() {
  if (stripeMode() === "sandbox") {
    return serverSecret("STRIPE_SANDBOX_SECRET_KEY_FILE", "STRIPE_SANDBOX_SECRET_KEY");
  }
  return serverSecret("STRIPE_SECRET_KEY_FILE", "STRIPE_SECRET_KEY");
}

export function stripeWebhookSecret() {
  if (stripeMode() === "sandbox") {
    return serverSecret("STRIPE_SANDBOX_WEBHOOK_SECRET_FILE", "STRIPE_SANDBOX_WEBHOOK_SECRET");
  }
  return serverSecret("STRIPE_WEBHOOK_SECRET_FILE", "STRIPE_WEBHOOK_SECRET");
}

export function renderCreditsPriceId() {
  if (stripeMode() === "sandbox") {
    return (process.env.STRIPE_SANDBOX_RENDER_CREDITS_PRICE_ID || "").trim();
  }
  return (process.env.STRIPE_RENDER_CREDITS_PRICE_ID || "").trim();
}

export function sendGridApiKey() {
  return serverSecret("SENDGRID_API_KEY_FILE", "SENDGRID_API_KEY");
}

export function sendGridFromEmail() {
  return (process.env.SENDGRID_FROM_EMAIL || "noreply@trainvent.com").trim();
}

export function sendGridFromName() {
  return (process.env.SENDGRID_FROM_NAME || "Trainvent Aperiodos").trim();
}

export function donationServiceAvailable() {
  return Boolean(stripeSecretKey());
}
