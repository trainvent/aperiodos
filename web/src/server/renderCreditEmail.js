import { ApiError } from "./http.js";
import { sendGridApiKey, sendGridFromEmail, sendGridFromName } from "./config.js";
import { buildLocalizedRenderCreditsPdf } from "./renderCredits.js";

const SENDGRID_MAIL_URL = "https://api.sendgrid.com/v3/mail/send";

const EMAIL_COPY = {
  en: {
    subject: "Your Aperiodos generation codes",
    greeting: "Thank you for your purchase.",
    intro: "Your 10 single-use generation codes are listed below and attached as an interactive PDF.",
    instruction: "Paste one code after your free daily generations are used. Each code can be redeemed once and does not expire.",
    attachment: "Attachment: aperiodos-generation-codes.pdf",
  },
  de: {
    subject: "Deine Aperiodos Generierungscodes",
    greeting: "Vielen Dank für deinen Einkauf.",
    intro: "Deine 10 einmalig nutzbaren Generierungscodes stehen unten und sind als interaktives PDF angehängt.",
    instruction: "Setze nach dem kostenlosen Tageslimit einen Code ein. Jeder Code kann einmal verwendet werden und verfällt nicht.",
    attachment: "Anhang: aperiodos-generation-codes.pdf",
  },
};

function normalizedLanguage(value) {
  return String(value || "").toLowerCase() === "de" ? "de" : "en";
}

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildRenderCreditEmail({ recipient, codes, language = "en" }) {
  const resolvedLanguage = normalizedLanguage(language);
  const copy = EMAIL_COPY[resolvedLanguage];
  const fromEmail = sendGridFromEmail();
  const fromName = sendGridFromName();
  const pdf = buildLocalizedRenderCreditsPdf(codes, resolvedLanguage);
  const codeLines = codes.join("\n");
  const codeItems = codes.map((code) => `<li><code>${htmlEscape(code)}</code></li>`).join("");

  return {
    personalizations: [{ to: [{ email: recipient }] }],
    from: { email: fromEmail, name: fromName },
    subject: copy.subject,
    content: [
      {
        type: "text/plain",
        value: `${copy.greeting}\n\n${copy.intro}\n\n${codeLines}\n\n${copy.instruction}\n\n${copy.attachment}\n\nTrainvent`,
      },
      {
        type: "text/html",
        value: `<p>${htmlEscape(copy.greeting)}</p><p>${htmlEscape(copy.intro)}</p><ol>${codeItems}</ol><p>${htmlEscape(copy.instruction)}</p><p>${htmlEscape(copy.attachment)}</p><p><strong>Trainvent</strong></p>`,
      },
    ],
    attachments: [{
      content: pdf.toString("base64"),
      type: "application/pdf",
      filename: "aperiodos-generation-codes.pdf",
      disposition: "attachment",
    }],
  };
}

export async function sendRenderCreditEmail({ recipient, codes, language }) {
  const apiKey = sendGridApiKey();
  if (!apiKey) throw new ApiError("Generation-code email delivery is not configured.", 503);
  if (!recipient) throw new ApiError("The paid checkout session has no customer email address.", 422);

  const response = await fetch(SENDGRID_MAIL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildRenderCreditEmail({ recipient, codes, language })),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1_000);
    throw new ApiError(`SendGrid rejected the generation-code email (${response.status}): ${detail}`, 502);
  }
}
