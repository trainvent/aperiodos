import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  buildRenderCreditsPdf,
  buildLocalizedRenderCreditsPdf,
  consumeLocalRenderCredit,
  deriveRenderCreditCodes,
  hashRenderCreditCode,
  issueRenderCreditBundle,
  normalizeRenderCreditCode,
} from "./renderCredits.js";

const storePath = path.resolve("..", ".sandbox", "render-credits.json");

test("render credit codes are stable, formatted, and hashable", () => {
  const previousStore = process.env.RENDER_QUOTA_STORE;
  const previousSecret = process.env.RENDER_CREDIT_SECRET;
  process.env.RENDER_QUOTA_STORE = "local";
  process.env.RENDER_CREDIT_SECRET = "test-render-credit-secret-at-least-32-characters";
  try {
    const codes = deriveRenderCreditCodes("cs_test_stable");
    assert.equal(codes.length, 10);
    assert.equal(new Set(codes).size, 10);
    assert.deepEqual(codes, deriveRenderCreditCodes("cs_test_stable"));
    assert.match(codes[0], /^AP[0-9A-F]{2}(?:-[0-9A-F]{4}){4}-[0-9A-F]{2}$/);
    assert.equal(normalizeRenderCreditCode(codes[0]), codes[0].replaceAll("-", ""));
    assert.equal(hashRenderCreditCode(codes[0]).length, 64);
  } finally {
    if (previousStore === undefined) delete process.env.RENDER_QUOTA_STORE;
    else process.env.RENDER_QUOTA_STORE = previousStore;
    if (previousSecret === undefined) delete process.env.RENDER_CREDIT_SECRET;
    else process.env.RENDER_CREDIT_SECRET = previousSecret;
  }
});

test("paid bundles issue ten codes idempotently and codes are single-use", async () => {
  let original;
  try { original = await fs.readFile(storePath); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  const previousStore = process.env.RENDER_QUOTA_STORE;
  const previousSecret = process.env.RENDER_CREDIT_SECRET;
  process.env.RENDER_QUOTA_STORE = "local";
  process.env.RENDER_CREDIT_SECRET = "test-render-credit-secret-at-least-32-characters";
  const session = {
    id: "cs_test_paid_bundle",
    payment_status: "paid",
    amount_total: 500,
    currency: "eur",
    metadata: { purchase_type: "render_credits" },
  };
  try {
    await fs.rm(storePath, { force: true });
    const first = await issueRenderCreditBundle(session);
    const second = await issueRenderCreditBundle(session);
    assert.deepEqual(second, first);
    const codeHash = hashRenderCreditCode(first[0]);
    assert.equal(await consumeLocalRenderCredit(codeHash), true);
    assert.equal(await consumeLocalRenderCredit(codeHash), false);
  } finally {
    if (original) await fs.writeFile(storePath, original);
    else await fs.rm(storePath, { force: true });
    if (previousStore === undefined) delete process.env.RENDER_QUOTA_STORE;
    else process.env.RENDER_QUOTA_STORE = previousStore;
    if (previousSecret === undefined) delete process.env.RENDER_CREDIT_SECRET;
    else process.env.RENDER_CREDIT_SECRET = previousSecret;
  }
});

test("generation code PDF contains all codes and a valid PDF trailer", () => {
  const codes = Array.from({ length: 10 }, (_, index) => `AP00-0000-0000-0000-0000-${String(index).padStart(2, "0")}`);
  const pdf = buildRenderCreditsPdf(codes);
  assert.equal(pdf.subarray(0, 8).toString(), "%PDF-1.4");
  assert.match(pdf.toString(), /AP00-0000-0000-0000-0000-09/);
  assert.match(pdf.toString(), /\(Trainvent\)/);
  assert.match(pdf.toString(), /\/Helvetica-Bold/);
  assert.equal(pdf.toString().match(/\/Subtype \/Widget/g)?.length, 10);
  assert.equal(pdf.toString().match(/\/FT \/Btn/g)?.length, 10);
  assert.match(pdf.toString(), /\/AcroForm 7 0 R/);
  assert.match(pdf.toString(), /\/AP << \/N << \/Off/);
  assert.match(pdf.toString(), /%%EOF/);

  const germanPdf = buildLocalizedRenderCreditsPdf(codes, "de").toString();
  assert.match(germanPdf, /\(Aperiodos Generierungscodes\)/);
  assert.match(germanPdf, /\(ERSTELLT VON\)/);
  assert.match(germanPdf, /Codes verfallen nicht/);
});
