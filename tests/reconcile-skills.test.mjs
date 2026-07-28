import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

test("reconciliation targets the external global skills directory", async () => {
  const script = await readFile(resolve("scripts/reconcile-skills.mjs"), "utf8");

  assert.match(script, /entry\.sourceUrl \?\? entry\.source/);
  assert.match(script, /"--global", "--agent", "cline"/);
});

test("loads MCPs from the configured directory after shared configuration", async () => {
  const home = await mkdtemp(join(tmpdir(), "opencode-home-"));
  const directory = join(home, "mcps");

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "machine.jsonc"), `{
      // Local entries override shared MCPs.
      "mcp": {
        "shared": { "type": "local", "command": ["local"] },
        "machine": { "type": "local", "command": ["machine"] }
      }
    }`);

    const pluginPath = JSON.stringify(resolve("plugins/load-external-mcps.mjs"));
    const output = await new Promise((resolveRun, reject) => {
      const child = spawn(process.execPath, ["--input-type=module", "--eval", `
        const plugin = (await import(${pluginPath})).default;
        const hooks = await plugin();
        const config = { mcp: { shared: { type: "local", command: ["shared"] } } };
        await hooks.config(config);
        console.log(JSON.stringify(config.mcp));
      `], { env: { ...process.env, HOME: home, OPENCODE_MCP_DIR: directory } });
      let stdout = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.once("error", reject);
      child.once("close", (code) => code === 0 ? resolveRun(stdout) : reject(new Error(`Plugin exited with ${code}`)));
    });

    assert.deepEqual(JSON.parse(output), {
      shared: { type: "local", command: ["local"] },
      machine: { type: "local", command: ["machine"] },
    });
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
