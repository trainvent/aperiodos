import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  EINSTEIN_DEFAULTS,
  PENROSE_DEFAULTS,
  SPECTRE_DEFAULTS,
} from "../features/generators/defaults.js";
import { DEFAULT_HTTP_HEIGHT, DEFAULT_HTTP_WIDTH, serverSecret } from "./config.js";

test("all generators use the server canvas defaults", () => {
  for (const defaults of [EINSTEIN_DEFAULTS, SPECTRE_DEFAULTS, PENROSE_DEFAULTS]) {
    assert.equal(defaults.width, DEFAULT_HTTP_WIDTH);
    assert.equal(defaults.height, DEFAULT_HTTP_HEIGHT);
  }
});

test("serverSecret reads a mounted file before an environment fallback", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aperiodos-secret-test-"));
  const secretPath = path.join(directory, "secret");
  const previousPath = process.env.TEST_SECRET_FILE;
  const previousValue = process.env.TEST_SECRET_VALUE;
  try {
    await fs.writeFile(secretPath, "mounted-secret\n", { mode: 0o400 });
    process.env.TEST_SECRET_FILE = secretPath;
    process.env.TEST_SECRET_VALUE = "environment-secret";
    assert.equal(serverSecret("TEST_SECRET_FILE", "TEST_SECRET_VALUE"), "mounted-secret");
  } finally {
    if (previousPath === undefined) delete process.env.TEST_SECRET_FILE;
    else process.env.TEST_SECRET_FILE = previousPath;
    if (previousValue === undefined) delete process.env.TEST_SECRET_VALUE;
    else process.env.TEST_SECRET_VALUE = previousValue;
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("serverSecret retains environment fallback for local development", () => {
  const previousPath = process.env.TEST_SECRET_FILE;
  const previousValue = process.env.TEST_SECRET_VALUE;
  try {
    delete process.env.TEST_SECRET_FILE;
    process.env.TEST_SECRET_VALUE = "local-only-secret";
    assert.equal(serverSecret("TEST_SECRET_FILE", "TEST_SECRET_VALUE"), "local-only-secret");
  } finally {
    if (previousPath === undefined) delete process.env.TEST_SECRET_FILE;
    else process.env.TEST_SECRET_FILE = previousPath;
    if (previousValue === undefined) delete process.env.TEST_SECRET_VALUE;
    else process.env.TEST_SECRET_VALUE = previousValue;
  }
});
