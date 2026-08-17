import assert from "node:assert/strict";
import test from "node:test";

import { buildRenderCreditEmail } from "./renderCreditEmail.js";

test("generation-code email is localized and includes the interactive PDF", () => {
  const previousEmail = process.env.SENDGRID_FROM_EMAIL;
  const previousName = process.env.SENDGRID_FROM_NAME;
  process.env.SENDGRID_FROM_EMAIL = "verified@example.com";
  process.env.SENDGRID_FROM_NAME = "Trainvent Aperiodos";
  try {
    const codes = Array.from({ length: 10 }, (_, index) =>
      `AP00-0000-0000-0000-0000-${String(index).padStart(2, "0")}`);
    const message = buildRenderCreditEmail({
      recipient: "customer@example.com",
      codes,
      language: "de",
    });

    assert.equal(message.personalizations[0].to[0].email, "customer@example.com");
    assert.equal(message.from.email, "verified@example.com");
    assert.equal(message.subject, "Deine Aperiodos Generierungscodes");
    assert.match(message.content[0].value, /AP00-0000-0000-0000-0000-09/);
    assert.equal(message.attachments[0].type, "application/pdf");
    const pdf = Buffer.from(message.attachments[0].content, "base64").toString();
    assert.match(pdf, /^%PDF-1\.4/);
    assert.match(pdf, /\(Aperiodos Generierungscodes\)/);
    assert.equal(pdf.match(/\/Subtype \/Widget/g)?.length, 10);
  } finally {
    if (previousEmail === undefined) delete process.env.SENDGRID_FROM_EMAIL;
    else process.env.SENDGRID_FROM_EMAIL = previousEmail;
    if (previousName === undefined) delete process.env.SENDGRID_FROM_NAME;
    else process.env.SENDGRID_FROM_NAME = previousName;
  }
});
