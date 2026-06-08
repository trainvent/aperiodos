import path from "node:path";

export const WEB_ROOT = process.cwd();
export const PROJECT_ROOT = path.basename(WEB_ROOT) === "web" ? path.resolve(WEB_ROOT, "..") : WEB_ROOT;
export const SRC_DIR = path.join(PROJECT_ROOT, "src");
export const GENERATORS_DIR = path.join(SRC_DIR, "generators");

export const DEFAULT_HTTP_WIDTH = 1600;
export const DEFAULT_HTTP_HEIGHT = 1600;
export const MAX_IMAGE_DIMENSION = 6000;
export const MAX_ITERATIONS = 6;
export const MAX_SCALAR = 80;
export const MAX_SPECTRE_LEVEL = 8;
export const MAX_SPECTRE_SCALE = 120;
export const MAX_PENROSE_ITERATIONS = 10;
export const MAX_PENROSE_SCALE = 1200;
export const P1_SCALE_NORMALIZATION = 10.0 / 320.0;

export const DEFAULT_COLORS = ["black", "seagreen", "white", "sandybrown", "gold"];
export const DEFAULT_FOUR_COLORS = ["seagreen", "sienna", "goldenrod", "midnightblue"];
export const DEFAULT_ITERATIONS = 5;
export const DEFAULT_SCALAR = 20;

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

export function stripeSecretKey() {
  if (stripeMode() === "sandbox") {
    return (process.env.STRIPE_SANDBOX_SECRET_KEY || "").trim();
  }
  return (process.env.STRIPE_SECRET_KEY || "").trim();
}

export function stripeWebhookSecret() {
  if (stripeMode() === "sandbox") {
    return (process.env.STRIPE_SANDBOX_WEBHOOK_SECRET || "").trim();
  }
  return (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
}

export function donationServiceAvailable() {
  return Boolean(stripeSecretKey());
}
