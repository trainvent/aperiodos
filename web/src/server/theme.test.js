import assert from "node:assert/strict";
import test from "node:test";

import { normalizeThemePreference, resolveTheme } from "../lib/theme.js";

test("theme preference defaults to automatic for unknown values", () => {
  assert.equal(normalizeThemePreference(null), "auto");
  assert.equal(normalizeThemePreference("sepia"), "auto");
  assert.equal(normalizeThemePreference("dark"), "dark");
});

test("automatic theme follows the browser preference", () => {
  assert.equal(resolveTheme("auto", false), "light");
  assert.equal(resolveTheme("auto", true), "dark");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});
