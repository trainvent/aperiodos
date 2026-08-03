import { createHmac } from "node:crypto";
import fs from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";

import { PROJECT_ROOT } from "./config.js";
import { firestore, firestoreConfigured } from "./firestore.js";
import { ApiError } from "./http.js";

export const DEFAULT_RENDER_DAILY_LIMIT = 3;
export const DEFAULT_RENDER_GLOBAL_DAILY_LIMIT = 50;
export const RENDER_QUOTA_COLLECTION = "render_quotas";

const LOCAL_DEVELOPMENT_SECRET = "aperiodos-local-render-quota-secret";
let localQuotaQueue = Promise.resolve();

function normalizedIp(value) {
  let ip = String(value || "").trim();
  if (ip.startsWith("::ffff:")) {
    ip = ip.slice(7);
  }
  return isIP(ip) ? ip.toLowerCase() : "";
}

export function extractClientIp(req, { trustProxy = Boolean(process.env.K_SERVICE) } = {}) {
  if (trustProxy) {
    const forwarded = String(req?.headers?.["x-forwarded-for"] || "")
      .split(",")
      .map(normalizedIp)
      .filter(Boolean);
    if (forwarded.length >= 2) {
      return forwarded.at(-2);
    }
    if (forwarded.length === 1) {
      return forwarded[0];
    }
  }

  return normalizedIp(req?.socket?.remoteAddress || req?.connection?.remoteAddress);
}

export function quotaWindow(now = new Date()) {
  const current = new Date(now);
  if (Number.isNaN(current.getTime())) {
    throw new TypeError("Invalid quota date.");
  }
  const day = current.toISOString().slice(0, 10);
  const resetAt = new Date(`${day}T00:00:00.000Z`);
  resetAt.setUTCDate(resetAt.getUTCDate() + 1);
  return { day, resetAt };
}

export function hashClientIp(ip, secret) {
  const cleanIp = normalizedIp(ip);
  if (!cleanIp) {
    throw new ApiError("Unable to identify the request source.", 400);
  }
  if (String(secret || "").length < 32) {
    throw new ApiError("Render quota is not configured on this server.", 503);
  }
  return createHmac("sha256", secret).update(cleanIp).digest("hex");
}

export function nextQuotaState(currentCount, limit = DEFAULT_RENDER_DAILY_LIMIT) {
  const count = Math.max(0, Number.parseInt(currentCount, 10) || 0);
  if (count >= limit) {
    return { allowed: false, count, remaining: 0 };
  }
  const nextCount = count + 1;
  return { allowed: true, count: nextCount, remaining: Math.max(0, limit - nextCount) };
}

export function nextCombinedQuotaState(
  currentIpCount,
  currentGlobalCount,
  ipLimit = DEFAULT_RENDER_DAILY_LIMIT,
  globalLimit = DEFAULT_RENDER_GLOBAL_DAILY_LIMIT,
) {
  const ipState = nextQuotaState(currentIpCount, ipLimit);
  const globalState = nextQuotaState(currentGlobalCount, globalLimit);
  if (!ipState.allowed) {
    return {
      allowed: false,
      blockedBy: "ip",
      count: ipState.count,
      remaining: 0,
      globalCount: Math.max(0, Number.parseInt(currentGlobalCount, 10) || 0),
      globalRemaining: Math.max(0, globalLimit - (Number.parseInt(currentGlobalCount, 10) || 0)),
    };
  }
  if (!globalState.allowed) {
    return {
      allowed: false,
      blockedBy: "global",
      count: Math.max(0, Number.parseInt(currentIpCount, 10) || 0),
      remaining: Math.max(0, ipLimit - (Number.parseInt(currentIpCount, 10) || 0)),
      globalCount: globalState.count,
      globalRemaining: 0,
    };
  }
  return {
    allowed: true,
    blockedBy: null,
    count: ipState.count,
    remaining: ipState.remaining,
    globalCount: globalState.count,
    globalRemaining: globalState.remaining,
  };
}

function dailyLimit() {
  const configured = Number.parseInt(process.env.RENDER_DAILY_LIMIT || String(DEFAULT_RENDER_DAILY_LIMIT), 10);
  if (!Number.isFinite(configured)) {
    return DEFAULT_RENDER_DAILY_LIMIT;
  }
  return Math.min(Math.max(configured, 1), 100);
}

function globalDailyLimit() {
  const configured = Number.parseInt(
    process.env.RENDER_GLOBAL_DAILY_LIMIT || String(DEFAULT_RENDER_GLOBAL_DAILY_LIMIT),
    10,
  );
  if (!Number.isFinite(configured)) {
    return DEFAULT_RENDER_GLOBAL_DAILY_LIMIT;
  }
  return Math.min(Math.max(configured, 1), 10_000);
}

function useLocalQuotaStore() {
  return String(process.env.RENDER_QUOTA_STORE || "").trim().toLowerCase() === "local";
}

function localQuotaStorePath() {
  return path.join(/* turbopackIgnore: true */ PROJECT_ROOT, ".sandbox", "render-quotas.json");
}

function quotaSecret() {
  const configured = String(process.env.RENDER_QUOTA_SECRET || "");
  return configured || (useLocalQuotaStore() ? LOCAL_DEVELOPMENT_SECRET : "");
}

async function readLocalQuotaStore() {
  try {
    const parsed = JSON.parse(await fs.readFile(localQuotaStorePath(), "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
    return {};
  }
}

async function reserveLocalQuota(documentId, globalDocumentId, day, limit, globalLimit, resetAt) {
  const operation = localQuotaQueue.then(async () => {
    const store = await readLocalQuotaStore();
    const state = nextCombinedQuotaState(
      store[documentId]?.count,
      store[globalDocumentId]?.count,
      limit,
      globalLimit,
    );
    if (state.allowed) {
      const currentDayEntries = Object.fromEntries(
        Object.entries(store).filter(([, entry]) => entry?.day === day),
      );
      currentDayEntries[documentId] = {
        day,
        count: state.count,
        scope: "ip",
        reset_at: resetAt.toISOString(),
      };
      currentDayEntries[globalDocumentId] = {
        day,
        count: state.globalCount,
        scope: "global",
        reset_at: resetAt.toISOString(),
      };
      const storePath = localQuotaStorePath();
      await fs.mkdir(path.dirname(storePath), { recursive: true });
      await fs.writeFile(storePath, `${JSON.stringify(currentDayEntries, null, 2)}\n`);
    }
    return state;
  });
  localQuotaQueue = operation.catch(() => undefined);
  return operation;
}

async function reserveFirestoreQuota(documentId, globalDocumentId, day, limit, globalLimit, resetAt) {
  if (!firestoreConfigured()) {
    throw new ApiError("Render quota storage is not configured on this server.", 503);
  }
  const database = firestore();
  const quotaRef = database.collection(RENDER_QUOTA_COLLECTION).doc(documentId);
  const globalQuotaRef = database.collection(RENDER_QUOTA_COLLECTION).doc(globalDocumentId);
  return database.runTransaction(async (transaction) => {
    const [snapshot, globalSnapshot] = await Promise.all([
      transaction.get(quotaRef),
      transaction.get(globalQuotaRef),
    ]);
    const state = nextCombinedQuotaState(
      snapshot.exists ? snapshot.data()?.count : 0,
      globalSnapshot.exists ? globalSnapshot.data()?.count : 0,
      limit,
      globalLimit,
    );
    if (state.allowed) {
      const timestamps = {
        day,
        reset_at: resetAt,
        expires_at: new Date(resetAt.getTime() + 7 * 24 * 60 * 60 * 1000),
        updated_at: new Date(),
      };
      transaction.set(
        quotaRef,
        {
          ...timestamps,
          count: state.count,
          scope: "ip",
        },
        { merge: true },
      );
      transaction.set(
        globalQuotaRef,
        {
          ...timestamps,
          count: state.globalCount,
          scope: "global",
        },
        { merge: true },
      );
    }
    return state;
  });
}

export async function enforceRenderQuota(req, res, { now = new Date() } = {}) {
  const ip = extractClientIp(req);
  const limit = dailyLimit();
  const globalLimit = globalDailyLimit();
  const { day, resetAt } = quotaWindow(now);
  const ipHash = hashClientIp(ip, quotaSecret());
  const documentId = `${day}_${ipHash}`;
  const globalDocumentId = `global_${day}`;

  let state;
  try {
    state = useLocalQuotaStore()
      ? await reserveLocalQuota(documentId, globalDocumentId, day, limit, globalLimit, resetAt)
      : await reserveFirestoreQuota(documentId, globalDocumentId, day, limit, globalLimit, resetAt);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error("Render quota reservation failed.", error);
    throw new ApiError("Generation quota is temporarily unavailable.", 503);
  }

  const resetEpochSeconds = Math.floor(resetAt.getTime() / 1000);
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(state.remaining));
  res.setHeader("X-RateLimit-Reset", String(resetEpochSeconds));
  res.setHeader("X-Global-RateLimit-Limit", String(globalLimit));
  res.setHeader("X-Global-RateLimit-Remaining", String(state.globalRemaining));

  if (!state.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - new Date(now).getTime()) / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.setHeader("X-RateLimit-Scope", state.blockedBy);
    const message =
      state.blockedBy === "global"
        ? `The service-wide daily generation limit has been reached. Try again after ${resetAt.toISOString()}.`
        : `Daily generation limit reached. Try again after ${resetAt.toISOString()}.`;
    throw new ApiError(message, 429);
  }

  return { ...state, limit, globalLimit, resetAt };
}
