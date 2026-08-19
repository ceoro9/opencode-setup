import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("AGENTS.md establishes Ponytail precedence, the selection ladder, and a verification floor", async () => {
  const rules = await readFile("AGENTS.md", "utf8");

  assert.match(rules, /Ponytail/);
  assert.match(rules, /never overrides this Priority Order/);
  assert.match(rules, /is the change actually needed, does it already exist in this codebase/);
  assert.match(rules, /verification floor, not a ceiling/);
});
