import assert from "node:assert/strict";
import test from "node:test";

import { getAboutContent, getAppVersion } from "./about.js";

test("About content exposes the deployed application version", () => {
  assert.equal(getAppVersion({ APP_VERSION: "v1.4.0" }), "v1.4.0");
  assert.equal(getAboutContent("en", { APP_VERSION: "v1.4.0" }).version, "v1.4.0");
});

test("About content has a local development version fallback", () => {
  assert.equal(getAppVersion({}), "development");
  assert.equal(getAppVersion({ APP_VERSION: "  " }), "development");
});
