import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const WEB_ROOT = process.cwd();
const PROJECT_ROOT = path.basename(WEB_ROOT) === "web" ? path.resolve(WEB_ROOT, "..") : WEB_ROOT;

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const values = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function loadEnvFile(filePath) {
  for (const [key, value] of Object.entries(parseEnvFile(filePath))) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const args = process.argv.slice(2);
const sandbox = args.includes("--sandbox") || process.env.npm_config_sandbox === "true";
const nextArgs = args.filter((arg) => arg !== "--sandbox");

if (process.env.SKIP_LOCAL_ENV_FILE !== "1") {
  loadEnvFile(path.join(PROJECT_ROOT, ".env"));
  loadEnvFile(path.join(WEB_ROOT, ".env"));
}

// Local development should not require Google Application Default Credentials.
// Cloud Run starts the production server directly and therefore does not use
// this default. Set SPONSORS_STORE=firestore explicitly to test Firestore locally.
process.env.SPONSORS_STORE = process.env.SPONSORS_STORE || "local";
process.env.RENDER_QUOTA_STORE = process.env.RENDER_QUOTA_STORE || "local";

if (sandbox) {
  process.env.STRIPE_MODE = "sandbox";
  process.env.FIRESTORE_DISABLED = process.env.FIRESTORE_DISABLED || "1";
  process.env.PUBLIC_APP_URL = process.env.SANDBOX_PUBLIC_APP_URL || "http://localhost:3000";
  console.log("Starting Next dev server in Stripe sandbox mode.");
} else {
  console.log("Starting Next dev server.");
}

if (process.env.SPONSORS_STORE === "local") {
  console.log("Using local sponsor storage at .sandbox/sponsors.json.");
} else {
  console.log("Using Firestore sponsor storage; Google Application Default Credentials are required.");
}

if (process.env.RENDER_QUOTA_STORE === "local") {
  console.log("Using local render quotas at .sandbox/render-quotas.json.");
}

const nextBin = path.join(WEB_ROOT, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");

const child = spawn(nextBin, ["dev", ...nextArgs], {
  cwd: WEB_ROOT,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
