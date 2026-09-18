import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const languages = ["en", "de", "el"];

function flattenKeys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child)
      ? flattenKeys(child, path)
      : [path];
  });
}

test("every supported locale contains the complete translation key set", () => {
  const keySets = Object.fromEntries(languages.map((language) => {
    const url = new URL(`../locales/${language}/common.json`, import.meta.url);
    const messages = JSON.parse(readFileSync(url, "utf8"));
    return [language, flattenKeys(messages).sort()];
  }));

  for (const language of languages.slice(1)) {
    assert.deepEqual(keySets[language], keySets.en, `${language} locale keys differ from English`);
  }
});
