import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFile = promisify(execFileCallback);
const pluginPath = resolve("plugins/agent-env.mjs");

async function git(args, cwd) {
  return execFile("git", args, { cwd, encoding: "utf8" });
}

async function worktree() {
  const directory = await mkdtemp(join(tmpdir(), "opencode-agentenv-"));
  await git(["init", "--initial-branch=main"], directory);
  await git(["config", "user.email", "test@example.com"], directory);
  await git(["config", "user.name", "Test"], directory);
  await writeFile(join(directory, "README.md"), "baseline\n");
  await git(["add", "README.md"], directory);
  await git(["commit", "-m", "initial"], directory);
  return directory;
}

function context(directory) {
  const metadata = [];
  return {
    worktree: directory,
    abort: new AbortController().signal,
    metadata(input) {
      metadata.push(input);
    },
    metadataCalls: metadata,
  };
}

async function loadPlugin(fetch) {
  return (await import(`${pluginPath}?test=${crypto.randomUUID()}`)).default({}, {
    agentenvUrl: "http://agentenv.test",
    agentenvApiKey: "agentenv-test-key",
    workerTemplate: "opencode-worker",
    cliproxyUrl: "https://cliproxy.test/v1",
    cliproxyApiKey: "cliproxy-test-key",
    fetch,
  });
}

test("list_workers returns only managed workers with normalized lifecycle data", async () => {
  const directory = await worktree();

  try {
    const hooks = await loadPlugin(async (url, init = {}) => {
      assert.equal(String(url), "http://agentenv.test/v2/sandboxes");
      assert.equal(init.headers["X-API-Key"], "agentenv-test-key");
      return new Response(JSON.stringify([
        {
          sandboxID: "sandbox-worker",
          alias: "opencode-worker-v2",
          state: "running",
          startedAt: "2026-08-02T09:00:00Z",
          endAt: "2026-08-02T10:00:00Z",
          cpuCount: 2,
          memoryMB: 4096,
          diskSizeMB: 65536,
          metadata: {
            opencodeAgentenvWorker: "worker-1",
            opencodeAgentenvName: "candidate-a",
            opencodeAgentenvModel: "cliproxy/deep",
            opencodeAgentenvCohort: "cohort-1",
            opencodeAgentenvBaseline: "abc123",
            purpose: "benchmark",
            candidate: "a",
          },
        },
        {
          sandboxID: "sandbox-unmanaged",
          alias: "other-template",
          state: "running",
          metadata: { purpose: "other" },
        },
      ]), { status: 200 });
    });
    const result = await hooks.tool.list_workers.execute({
      states: ["running"],
      cohortID: "cohort-1",
      metadata: { purpose: "benchmark" },
    }, context(directory));
    const output = JSON.parse(result.output);

    assert.deepEqual(output.workers, [{
      workerID: "worker-1",
      name: "candidate-a",
      model: { providerID: "cliproxy", modelID: "deep" },
      metadata: { purpose: "benchmark", candidate: "a" },
      cohortID: "cohort-1",
      baselineCommit: "abc123",
      sandboxID: "sandbox-worker",
      template: "opencode-worker-v2",
      state: "running",
      startedAt: "2026-08-02T09:00:00Z",
      expiresAt: "2026-08-02T10:00:00Z",
      resources: { cpuCount: 2, memoryMB: 4096, diskSizeMB: 65536 },
    }]);
    assert.doesNotMatch(result.output, /opencodeAgentenv/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("list_workers filters workers by metadata without requiring a Git baseline", async () => {
  const directory = await worktree();

  try {
    await writeFile(join(directory, "README.md"), "modified\n");
    const hooks = await loadPlugin(async () => new Response(JSON.stringify([
      {
        sandboxID: "sandbox-a",
        state: "paused",
        metadata: { opencodeAgentenvWorker: "worker-a", opencodeAgentenvName: "a", purpose: "review" },
      },
      {
        sandboxID: "sandbox-b",
        state: "running",
        metadata: { opencodeAgentenvWorker: "worker-b", opencodeAgentenvName: "b", purpose: "implementation" },
      },
    ]), { status: 200 }));
    const result = await hooks.tool.list_workers.execute({ metadata: { purpose: "review" } }, context(directory));
    const output = JSON.parse(result.output);

    assert.deepEqual(output.workers.map((worker) => worker.workerID), ["worker-a"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("spawn_worker creates one isolated worker per explicitly selected model", async () => {
  const directory = await worktree();
  const calls = [];

  try {
    const hooks = await loadPlugin(async (url, init = {}) => {
      calls.push({ url: String(url), init });

      if (init.method === "POST") {
        const body = JSON.parse(init.body);
        return new Response(JSON.stringify({ sandboxID: `sandbox-${body.metadata.opencodeAgentenvWorker}` }), { status: 201 });
      }

      return new Response(JSON.stringify({ templateID: "opencode-worker" }), { status: 200 });
    });
    const tool = hooks.tool.spawn_worker;
    const toolContext = context(directory);
    const result = await tool.execute({
      metadata: { purpose: "benchmark", task: "worker-spawn" },
      workerAgent: "build",
      models: [
        { providerID: "cliproxy", modelID: "model-a", name: "candidate-a", metadata: { candidate: "a" } },
        { providerID: "cliproxy", modelID: "model-b", name: "candidate-b", metadata: { candidate: "b" } },
      ],
    }, toolContext);
    const output = JSON.parse(result.output);
    const creates = calls.filter(({ init }) => init.method === "POST");

    assert.equal(calls[0].url, "http://agentenv.test/templates/opencode-worker");
    assert.equal(creates.length, 2);
    assert.equal(output.workers.length, 2);
    assert.ok(output.workers.every((worker) => worker.status === "spawned"));
    assert.equal(output.baseline.commit.length, 40);
    assert.deepEqual(output.metadata, { purpose: "benchmark", task: "worker-spawn" });
    assert.deepEqual(output.workers.map((worker) => worker.name), ["candidate-a", "candidate-b"]);
    assert.deepEqual(output.workers.map((worker) => worker.metadata), [
      { purpose: "benchmark", task: "worker-spawn", candidate: "a" },
      { purpose: "benchmark", task: "worker-spawn", candidate: "b" },
    ]);
    assert.equal(toolContext.metadataCalls.length, 1);

    for (const { init } of creates) {
      const request = JSON.parse(init.body);
      const config = JSON.parse(request.envVars.OPENCODE_CONFIG_CONTENT);

      assert.equal(request.templateID, "opencode-worker");
      assert.equal(request.metadata.purpose, "benchmark");
      assert.equal(request.metadata.task, "worker-spawn");
      assert.equal(request.metadata.candidate, request.metadata.opencodeAgentenvName === "candidate-a" ? "a" : "b");
      assert.equal(request.autoPause, false);
      assert.equal(request.secure, true);
      assert.equal(request.timeout, 3600);
      assert.deepEqual(request.network, { allowPublicTraffic: true });
      assert.equal(request.envVars.OPENCODE_SERVER_PASSWORD.length > 0, true);
      assert.equal(request.envVars.OPENCODE_WORKER_AGENT, "build");
      assert.equal(config.provider.cliproxy.options.baseURL, "https://cliproxy.test/v1");
      assert.equal(config.provider.cliproxy.options.apiKey, "cliproxy-test-key");
      assert.equal(config.model, `cliproxy/${request.metadata.opencodeAgentenvModel.split("/")[1]}`);
      assert.equal(init.headers["X-API-Key"], "agentenv-test-key");
    }

    assert.doesNotMatch(result.output, /cliproxy-test-key|agentenv-test-key/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("spawn_worker rejects duplicate models before provisioning", async () => {
  const directory = await worktree();
  let requests = 0;

  try {
    const hooks = await loadPlugin(async () => {
      requests += 1;
      return new Response("{}", { status: 200 });
    });

    await assert.rejects(
      hooks.tool.spawn_worker.execute({
        models: [
          { providerID: "cliproxy", modelID: "model-a" },
          { providerID: "cliproxy", modelID: "model-a" },
        ],
      }, context(directory)),
      /must be unique/,
    );
    assert.equal(requests, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("spawn_worker rejects dirty host worktrees", async () => {
  const directory = await worktree();
  let requests = 0;

  try {
    await writeFile(join(directory, "README.md"), "modified\n");
    const hooks = await loadPlugin(async () => {
      requests += 1;
      return new Response("{}", { status: 200 });
    });

    await assert.rejects(
      hooks.tool.spawn_worker.execute({
        models: [{ providerID: "cliproxy", modelID: "model-a" }],
      }, context(directory)),
      /clean Git worktree/,
    );
    assert.equal(requests, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("spawn_worker preserves successful workers when one sandbox fails", async () => {
  const directory = await worktree();
  let createCount = 0;

  try {
    const hooks = await loadPlugin(async (_url, init = {}) => {
      if (init.method !== "POST") return new Response("{}", { status: 200 });
      createCount += 1;
      if (createCount === 1) return new Response(JSON.stringify({ message: "capacity exhausted" }), { status: 503 });
      return new Response(JSON.stringify({ sandboxID: "sandbox-ready" }), { status: 201 });
    });
    const result = await hooks.tool.spawn_worker.execute({
      models: [
        { providerID: "cliproxy", modelID: "model-a" },
        { providerID: "cliproxy", modelID: "model-b" },
      ],
    }, context(directory));
    const output = JSON.parse(result.output);

    assert.deepEqual(output.workers.map((worker) => worker.status), ["failed", "spawned"]);
    assert.equal(output.workers[0].error, "POST /sandboxes failed with HTTP 503");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
