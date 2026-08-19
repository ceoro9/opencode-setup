import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// Reconciles the local OpenViking CLI client used by the openviking-opencode
// plugin. The OpenViking server runs remotely; this machine only needs the `ov`
// CLI plus its config pointing at that server. Everything here is host-specific,
// so nothing is committed:
//
//   OPENVIKING_SERVER_URL  required  base URL of the remote server
//   OPENVIKING_API_KEY     required  user/admin API key for data access
//                                    (the server runs api_key auth; ROOT keys
//                                    cannot access tenant-scoped data APIs)
//   OPENVIKING_LANGUAGE    optional  CLI display language, defaults to "en"
//
// Every failure mode is non-fatal so `npm install` never breaks on machines
// that do not use OpenViking (no env, no Python, offline, etc.).

const serverUrl = process.env.OPENVIKING_SERVER_URL?.trim();
const apiKey = process.env.OPENVIKING_API_KEY?.trim();
const language = process.env.OPENVIKING_LANGUAGE?.trim() || "en";

if (!serverUrl) {
  console.log(
    "openviking: OPENVIKING_SERVER_URL is not set; skipping OpenViking CLI setup.",
  );
  process.exit(0);
}

if (!apiKey) {
  console.log(
    "openviking: OPENVIKING_API_KEY is not set; skipping OpenViking CLI setup. " +
      "Use a user/admin key (root keys cannot access data APIs).",
  );
  process.exit(0);
}

const configDir = join(homedir(), ".openviking");

const run = (command, args) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", () => resolve(false));
    child.once("close", (code) => resolve(code === 0));
  });

const hasCommand = (command) =>
  new Promise((resolve) => {
    const child = spawn("command", ["-v", command], { stdio: "ignore", shell: true });
    child.once("error", () => resolve(false));
    child.once("close", (code) => resolve(code === 0));
  });

async function writeConfigFile(name, desired) {
  const path = join(configDir, name);
  const current = await readFile(path, "utf8").catch(() => null);
  if (current === desired) {
    return false;
  }
  await mkdir(configDir, { recursive: true });
  await writeFile(path, desired, "utf8");
  return true;
}

async function writeConfig() {
  const cliConfig = `${JSON.stringify(
    { url: serverUrl, api_key: apiKey, timeout: 60.0, output: "table" },
    null,
    2,
  )}\n`;
  const settings = `${JSON.stringify({ language }, null, 2)}\n`;

  const wroteConfig = await writeConfigFile("ovcli.conf", cliConfig);
  await writeConfigFile("ovcli.settings.conf", settings);
  console.log(
    wroteConfig
      ? `openviking: wrote ~/.openviking/ovcli.conf targeting ${serverUrl}`
      : `openviking: ovcli.conf already targets ${serverUrl}`,
  );
}

async function tryInstall() {
  if (await hasCommand("pipx")) {
    console.log("openviking: installing `ov` CLI via pipx install openviking");
    if (await run("pipx", ["install", "openviking"])) {
      return true;
    }
    console.log("openviking: pipx install failed; trying uv tool install next.");
  }

  if (await hasCommand("uv")) {
    console.log("openviking: installing `ov` CLI via uv tool install openviking");
    if (await run("uv", ["tool", "install", "openviking"])) {
      return true;
    }
    console.log("openviking: uv tool install failed; trying pip --user next.");
  }

  const pip = (await hasCommand("pip3")) ? "pip3" : (await hasCommand("pip")) ? "pip" : null;
  if (!pip) {
    return false;
  }

  console.log(`openviking: installing \`ov\` CLI via ${pip} install --user openviking`);
  return run(pip, ["install", "--user", "--upgrade", "openviking"]);
}

async function ensureCli() {
  if (await hasCommand("ov")) {
    return true;
  }

  const installed = await tryInstall();
  if (!installed) {
    console.log(
      "openviking: could not install the `ov` CLI automatically. Install it manually with: " +
        "pipx install openviking (recommended) or pip install --user openviking",
    );
    return false;
  }

  if (!(await hasCommand("ov"))) {
    console.log(
      "openviking: installed the openviking package but `ov` is not on PATH. " +
        "Ensure the pipx or pip --user bin directory is on PATH.",
    );
    return false;
  }

  return true;
}

// The postinstall step chains this script with `&&`, so a non-zero exit would
// break `npm install`. Every branch above already targets a clean exit, but a
// top-level guard enforces that invariant structurally: setup problems are
// logged, never fatal.
try {
  await writeConfig();
  await ensureCli();
} catch (error) {
  console.log(`openviking: skipping setup after an unexpected error: ${error.message}`);
  process.exit(0);
}
