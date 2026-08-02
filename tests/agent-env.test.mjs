import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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

async function loadPlugin(fetch, options = {}) {
  return (await import(`${pluginPath}?test=${crypto.randomUUID()}`)).default({}, {
    agentenvUrl: "http://agentenv.test",
    agentenvApiKey: "agentenv-test-key",
    workerTemplate: "opencode-worker",
    cliproxyUrl: "https://cliproxy.test/v1",
    cliproxyApiKey: "cliproxy-test-key",
    credentialStore: join(tmpdir(), `opencode-agentenv-credentials-${crypto.randomUUID()}.json`),
    bootstrapWorker: async () => undefined,
    waitForWorkerHealth: async () => ({ healthy: true, version: "1.18.11" }),
    fetch,
    ...options,
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

test("run_task submits work asynchronously and get_task retrieves the result", async () => {
  const directory = await worktree();
  const credentialStore = join(tmpdir(), `opencode-agentenv-run-task-${crypto.randomUUID()}.json`);
  const requests = [];

  try {
    await writeFile(credentialStore, JSON.stringify({
      version: 1,
      workers: {
        "worker-1": {
          workerID: "worker-1",
          sandboxID: "sandbox-1",
          serverPassword: "worker-secret",
          workerAgent: "build",
          model: { providerID: "cliproxy", modelID: "deep" },
        },
      },
    }));
    const hooks = await loadPlugin(async (url, init = {}) => {
      requests.push({ url: String(url), init });

      if (String(url) === "http://agentenv.test/v2/sandboxes") {
        return new Response(JSON.stringify([{
          sandboxID: "sandbox-1",
          alias: "opencode-worker-v2",
          state: "running",
          metadata: {
            opencodeAgentenvWorker: "worker-1",
            opencodeAgentenvName: "implementation-deep",
            opencodeAgentenvModel: "cliproxy/deep",
          },
        }]), { status: 200 });
      }
      if (String(url).endsWith("/global/health")) {
        return new Response(JSON.stringify({ healthy: true, version: "1.18.11" }), { status: 200 });
      }
      if (String(url).endsWith("/session")) {
        return new Response(JSON.stringify({ id: "session-1" }), { status: 200 });
      }
      if (String(url).endsWith("/session/session-1/prompt_async")) {
        return new Response(null, { status: 204 });
      }
      if (String(url).endsWith("/session/status")) {
        return new Response(JSON.stringify({}), { status: 200 });
      }
      if (String(url).endsWith("/session/session-1/message")) {
        return new Response(JSON.stringify([{
          info: { id: "message-1", role: "assistant", providerID: "cliproxy", modelID: "deep", agent: "build", time: { completed: 123 } },
          parts: [
            { type: "text", text: "Task " },
            { type: "tool", state: { status: "completed" } },
            { type: "text", text: "complete" },
          ],
        }]), { status: 200 });
      }
      throw new Error(`Unexpected request ${String(url)}`);
    }, { credentialStore });
    const result = await hooks.tool.run_task.execute({
      workerID: "worker-1",
      task: "Implement the requested change",
      title: "Implementation task",
    }, context(directory));
    const submitted = JSON.parse(result.output);
    const promptRequest = requests.find(({ url }) => url.endsWith("/session/session-1/prompt_async"));
    const prompt = JSON.parse(promptRequest.init.body);

    assert.equal(submitted.workerID, "worker-1");
    assert.equal(submitted.sessionID, "session-1");
    assert.equal(submitted.status, "submitted");
    assert.ok(submitted.taskID);
    assert.deepEqual(prompt.model, { providerID: "cliproxy", modelID: "deep" });
    assert.equal(prompt.agent, "build");
    assert.equal(prompt.parts[0].text, "Implement the requested change");
    assert.equal(promptRequest.init.headers["x-agentenv-sandbox-id"], "sandbox-1");
    assert.equal(promptRequest.init.headers["x-agentenv-target-port"], "4096");
    assert.equal(promptRequest.init.headers.Authorization, `Basic ${Buffer.from("opencode:worker-secret").toString("base64")}`);
    assert.doesNotMatch(result.output, /worker-secret|Task complete/);

    const taskResult = await hooks.tool.get_task.execute({ taskID: submitted.taskID }, context(directory));
    const completed = JSON.parse(taskResult.output);
    assert.equal(completed.status, "completed");
    assert.equal(completed.text, "Task complete");
    assert.equal(completed.completedAt, 123);

    const taskList = await hooks.tool.list_tasks.execute({ statuses: ["completed"] }, context(directory));
    const listed = JSON.parse(taskList.output);
    assert.deepEqual(listed.tasks.map((task) => task.taskID), [submitted.taskID]);
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(credentialStore, { force: true });
  }
});

test("run_task durably records a failed asynchronous submission", async () => {
  const directory = await worktree();
  const credentialStore = join(tmpdir(), `opencode-agentenv-failed-submit-${crypto.randomUUID()}.json`);

  try {
    await writeFile(credentialStore, JSON.stringify({
      version: 1,
      workers: {
        "worker-1": {
          workerID: "worker-1",
          sandboxID: "sandbox-1",
          serverPassword: "worker-secret",
          workerAgent: "build",
          model: { providerID: "cliproxy", modelID: "deep" },
        },
      },
      tasks: {},
    }));
    const hooks = await loadPlugin(async (url) => {
      if (String(url) === "http://agentenv.test/v2/sandboxes") {
        return new Response(JSON.stringify([{
          sandboxID: "sandbox-1",
          state: "running",
          metadata: { opencodeAgentenvWorker: "worker-1", opencodeAgentenvName: "worker", opencodeAgentenvModel: "cliproxy/deep" },
        }]), { status: 200 });
      }
      if (String(url).endsWith("/global/health")) return new Response(JSON.stringify({ healthy: true }), { status: 200 });
      if (String(url).endsWith("/session")) return new Response(JSON.stringify({ id: "session-1" }), { status: 200 });
      if (String(url).endsWith("/prompt_async")) return new Response("failed", { status: 503 });
      throw new Error(`Unexpected request ${String(url)}`);
    }, { credentialStore });

    await assert.rejects(
      hooks.tool.run_task.execute({ workerID: "worker-1", task: "test" }, context(directory)),
      /HTTP 503/,
    );
    const state = JSON.parse(await readFile(credentialStore, "utf8"));
    const tasks = Object.values(state.tasks);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].status, "failed");
    assert.equal(tasks[0].sessionID, "session-1");
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(credentialStore, { force: true });
    await rm(`${credentialStore}.lock`, { force: true });
  }
});

test("run_task rejects workers without a matching local credential", async () => {
  const directory = await worktree();

  try {
    const hooks = await loadPlugin(async () => new Response(JSON.stringify([{
      sandboxID: "sandbox-1",
      state: "running",
      metadata: { opencodeAgentenvWorker: "worker-1" },
    }]), { status: 200 }));

    await assert.rejects(
      hooks.tool.run_task.execute({ workerID: "worker-1", task: "test" }, context(directory)),
      /no matching local credential/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("spawn_worker creates one isolated worker per explicitly selected model", async () => {
  const directory = await worktree();
  const credentialStore = join(tmpdir(), `opencode-agentenv-spawn-${crypto.randomUUID()}.json`);
  const calls = [];

  try {
    const hooks = await loadPlugin(async (url, init = {}) => {
      calls.push({ url: String(url), init });

      if (init.method === "POST") {
        const body = JSON.parse(init.body);
        return new Response(JSON.stringify({ sandboxID: `sandbox-${body.metadata.opencodeAgentenvWorker}` }), { status: 201 });
      }

      return new Response(JSON.stringify({ templateID: "opencode-worker" }), { status: 200 });
    }, { credentialStore });
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
    const credentials = JSON.parse(await readFile(credentialStore, "utf8"));
    const credentialEntries = Object.values(credentials.workers);
    assert.equal(credentialEntries.length, 2);
    assert.deepEqual(credentialEntries.map((entry) => entry.model.modelID).sort(), ["model-a", "model-b"]);
    assert.ok(credentialEntries.every((entry) => entry.serverPassword));
    assert.equal((await stat(credentialStore)).mode & 0o777, 0o600);
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(credentialStore, { force: true });
  }
});

test("concurrent spawn_worker calls preserve every worker credential", async () => {
  const directory = await worktree();
  const credentialStore = join(tmpdir(), `opencode-agentenv-concurrent-${crypto.randomUUID()}.json`);

  try {
    const fetch = async (_url, init = {}) => {
      if (init.method !== "POST") return new Response("{}", { status: 200 });
      const body = JSON.parse(init.body);
      return new Response(JSON.stringify({ sandboxID: `sandbox-${body.metadata.opencodeAgentenvWorker}` }), { status: 201 });
    };
    const [first, second] = await Promise.all([
      loadPlugin(fetch, { credentialStore }),
      loadPlugin(fetch, { credentialStore }),
    ]);

    await Promise.all([
      first.tool.spawn_worker.execute({ models: [{ providerID: "cliproxy", modelID: "model-a" }] }, context(directory)),
      second.tool.spawn_worker.execute({ models: [{ providerID: "cliproxy", modelID: "model-b" }] }, context(directory)),
    ]);

    const state = JSON.parse(await readFile(credentialStore, "utf8"));
    assert.deepEqual(Object.values(state.workers).map((worker) => worker.model.modelID).sort(), ["model-a", "model-b"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(credentialStore, { force: true });
    await rm(`${credentialStore}.lock`, { force: true });
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

test("spawn_worker reports failure when the injected-environment server bootstrap fails", async () => {
  const directory = await worktree();
  const credentialStore = join(tmpdir(), `opencode-agentenv-bootstrap-${crypto.randomUUID()}.json`);

  try {
    const hooks = await loadPlugin(async (_url, init = {}) => {
      if (init.method === "POST") return new Response(JSON.stringify({ sandboxID: "sandbox-1" }), { status: 201 });
      return new Response("{}", { status: 200 });
    }, {
      credentialStore,
      bootstrapWorker: async () => { throw new Error("bootstrap failed"); },
    });
    const result = await hooks.tool.spawn_worker.execute({
      models: [{ providerID: "cliproxy", modelID: "model-a" }],
    }, context(directory));
    const output = JSON.parse(result.output);

    assert.equal(output.workers[0].status, "failed");
    assert.equal(output.workers[0].error, "bootstrap failed");
    await assert.rejects(readFile(credentialStore), /ENOENT/);
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(credentialStore, { force: true });
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
