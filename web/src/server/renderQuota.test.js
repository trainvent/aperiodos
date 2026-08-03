import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  enforceRenderQuota,
  extractClientIp,
  hashClientIp,
  nextCombinedQuotaState,
  nextQuotaState,
  quotaWindow,
} from "./renderQuota.js";

test("extractClientIp ignores spoofable forwarded values before Google's client position", () => {
  const request = {
    headers: {
      "x-forwarded-for": "198.51.100.12, 203.0.113.42, 35.191.0.1",
    },
    socket: { remoteAddress: "10.0.0.2" },
  };
  assert.equal(extractClientIp(request, { trustProxy: true }), "203.0.113.42");
  assert.equal(extractClientIp(request, { trustProxy: false }), "10.0.0.2");
});

test("extractClientIp normalizes IPv4-mapped socket addresses", () => {
  assert.equal(
    extractClientIp({ headers: {}, socket: { remoteAddress: "::ffff:127.0.0.1" } }),
    "127.0.0.1",
  );
});

test("quotaWindow resets at the next UTC midnight", () => {
  const window = quotaWindow(new Date("2026-08-03T23:59:59.000Z"));
  assert.equal(window.day, "2026-08-03");
  assert.equal(window.resetAt.toISOString(), "2026-08-04T00:00:00.000Z");
});

test("hashClientIp is deterministic and secret-dependent", () => {
  const first = hashClientIp("203.0.113.42", "a".repeat(32));
  assert.equal(first, hashClientIp("203.0.113.42", "a".repeat(32)));
  assert.notEqual(first, hashClientIp("203.0.113.42", "b".repeat(32)));
  assert.equal(first.length, 64);
});

test("nextQuotaState permits exactly three reservations", () => {
  assert.deepEqual(nextQuotaState(0, 3), { allowed: true, count: 1, remaining: 2 });
  assert.deepEqual(nextQuotaState(2, 3), { allowed: true, count: 3, remaining: 0 });
  assert.deepEqual(nextQuotaState(3, 3), { allowed: false, count: 3, remaining: 0 });
});

test("nextCombinedQuotaState blocks without consuming the other allowance", () => {
  assert.deepEqual(nextCombinedQuotaState(1, 50, 3, 50), {
    allowed: false,
    blockedBy: "global",
    count: 1,
    remaining: 2,
    globalCount: 50,
    globalRemaining: 0,
  });
  assert.deepEqual(nextCombinedQuotaState(2, 49, 3, 50), {
    allowed: true,
    blockedBy: null,
    count: 3,
    remaining: 0,
    globalCount: 50,
    globalRemaining: 0,
  });
});

test("local quota reservations serialize concurrent requests", async () => {
  const storePath = path.resolve("..", ".sandbox", "render-quotas.json");
  let previousStore;
  try {
    previousStore = await fs.readFile(storePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
  const previous = {
    store: process.env.RENDER_QUOTA_STORE,
    secret: process.env.RENDER_QUOTA_SECRET,
    limit: process.env.RENDER_DAILY_LIMIT,
    globalLimit: process.env.RENDER_GLOBAL_DAILY_LIMIT,
  };
  process.env.RENDER_QUOTA_STORE = "local";
  process.env.RENDER_QUOTA_SECRET = "test-secret-that-is-at-least-32-characters";
  process.env.RENDER_DAILY_LIMIT = "3";
  process.env.RENDER_GLOBAL_DAILY_LIMIT = "3";

  try {
    const request = { headers: {}, socket: { remoteAddress: "203.0.113.88" } };
    const testNow = new Date("2099-01-01T12:00:00Z");
    const reserve = () => enforceRenderQuota(request, { setHeader() {} }, { now: testNow });
    const results = await Promise.allSettled([reserve(), reserve(), reserve(), reserve()]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 3);
    const rejection = results.find((result) => result.status === "rejected");
    assert.equal(rejection.reason.statusCode, 429);

    const headers = new Map();
    await assert.rejects(
      enforceRenderQuota(
        { headers: {}, socket: { remoteAddress: "203.0.113.99" } },
        { setHeader(name, value) { headers.set(name, value); } },
        { now: testNow },
      ),
      (error) => error.statusCode === 429,
    );
    assert.equal(headers.get("X-RateLimit-Scope"), "global");
  } finally {
    for (const [key, value] of Object.entries({
      RENDER_QUOTA_STORE: previous.store,
      RENDER_QUOTA_SECRET: previous.secret,
      RENDER_DAILY_LIMIT: previous.limit,
      RENDER_GLOBAL_DAILY_LIMIT: previous.globalLimit,
    })) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    if (previousStore) {
      await fs.writeFile(storePath, previousStore);
    } else {
      await fs.rm(storePath, { force: true });
    }
  }
});
