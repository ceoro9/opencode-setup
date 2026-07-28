import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cli = resolve(root, "node_modules/skills/bin/cli.mjs");
const lock = JSON.parse(await readFile(resolve(root, "skills-lock.json"), "utf8"));

for (const [skill, entry] of Object.entries(lock.skills)) {
  const source = entry.sourceUrl ?? entry.source;
  const ref = entry.ref ? `#${entry.ref}` : "";
  const args = ["add", `${source}${ref}`, "--global", "--agent", "cline", "--skill", skill, "--full-depth", "--yes"];

  await new Promise((resolveInstall, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolveInstall() : reject(new Error(`Failed to install ${skill}`)));
  });
}
