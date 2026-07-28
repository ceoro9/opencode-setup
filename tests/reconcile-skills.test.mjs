import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

test("reconciliation targets the external global skills directory", async () => {
  const script = await readFile(resolve("scripts/reconcile-skills.mjs"), "utf8");

  assert.match(script, /entry\.sourceUrl \?\? entry\.source/);
  assert.match(script, /entry\.ref \? `#\$\{entry\.ref\}` : ""/);
  assert.match(script, /"--global", "--agent", "cline"/);
  assert.match(script, /"--skill", skill, "--full-depth", "--yes"/);
});
