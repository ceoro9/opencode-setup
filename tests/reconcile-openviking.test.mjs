import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

const script = resolve("scripts/reconcile-openviking.mjs");

function runScript(env) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [script], {
      env: { ...process.env, ...env },
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => resolveRun({ code, stdout }));
  });
}

const validEnv = (home) => ({
  HOME: home,
  OPENVIKING_SERVER_URL: "http://example.test:1933",
  OPENVIKING_API_KEY: "user-data-key",
  // Empty PATH deterministically skips the CLI-install branch; config is still
  // written first, which is the behavior under test.
  PATH: "",
});

test("skips cleanly when OPENVIKING_SERVER_URL is unset", async () => {
  const home = await mkdtemp(join(tmpdir(), "openviking-home-"));
  try {
    const { code, stdout } = await runScript({
      HOME: home,
      OPENVIKING_SERVER_URL: "",
      OPENVIKING_API_KEY: "user-data-key",
    });
    assert.equal(code, 0);
    assert.match(stdout, /OPENVIKING_SERVER_URL is not set/);
    await assert.rejects(readFile(join(home, ".openviking", "ovcli.conf"), "utf8"));
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("skips cleanly when OPENVIKING_API_KEY is unset", async () => {
  const home = await mkdtemp(join(tmpdir(), "openviking-home-"));
  try {
    const { code, stdout } = await runScript({
      HOME: home,
      OPENVIKING_SERVER_URL: "http://example.test:1933",
      OPENVIKING_API_KEY: "",
    });
    assert.equal(code, 0);
    assert.match(stdout, /OPENVIKING_API_KEY is not set/);
    await assert.rejects(readFile(join(home, ".openviking", "ovcli.conf"), "utf8"));
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("writes ovcli.conf with the server URL and user API key", async () => {
  const home = await mkdtemp(join(tmpdir(), "openviking-home-"));
  try {
    const { code } = await runScript(validEnv(home));
    assert.equal(code, 0);
    const config = JSON.parse(await readFile(join(home, ".openviking", "ovcli.conf"), "utf8"));
    assert.deepEqual(config, {
      url: "http://example.test:1933",
      api_key: "user-data-key",
      timeout: 60,
      output: "table",
    });
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("writes the language settings file to avoid the first-run prompt", async () => {
  const home = await mkdtemp(join(tmpdir(), "openviking-home-"));
  try {
    await runScript({ ...validEnv(home), OPENVIKING_LANGUAGE: "zh-CN" });
    const settings = JSON.parse(
      await readFile(join(home, ".openviking", "ovcli.settings.conf"), "utf8"),
    );
    assert.deepEqual(settings, { language: "zh-CN" });
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("defaults the language to English", async () => {
  const home = await mkdtemp(join(tmpdir(), "openviking-home-"));
  try {
    await runScript(validEnv(home));
    const settings = JSON.parse(
      await readFile(join(home, ".openviking", "ovcli.settings.conf"), "utf8"),
    );
    assert.deepEqual(settings, { language: "en" });
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("exits 0 even when the config directory cannot be created", async () => {
  // HOME points at /dev/null, so mkdir(~/.openviking) fails. postinstall chains
  // this script with &&, so it must still exit 0 rather than break npm install.
  const { code, stdout } = await runScript({
    HOME: "/dev/null",
    OPENVIKING_SERVER_URL: "http://example.test:1933",
    OPENVIKING_API_KEY: "user-data-key",
    PATH: "",
  });
  assert.equal(code, 0);
  assert.match(stdout, /skipping setup after an unexpected error/);
});

test("is idempotent and does not rewrite an unchanged config", async () => {
  const home = await mkdtemp(join(tmpdir(), "openviking-home-"));
  try {
    await runScript(validEnv(home));
    const { stdout } = await runScript(validEnv(home));
    assert.match(stdout, /ovcli\.conf already targets http:\/\/example\.test:1933/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
