import { execFile as execFileCallback } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { tool } from "@opencode-ai/plugin";

const execFile = promisify(execFileCallback);
const defaultLeaseSeconds = 3600;
const maxLeaseSeconds = 3600;
const maxModelsPerCohort = 8;

const modelSchema = tool.schema.object({
  providerID: tool.schema.string().min(1),
  modelID: tool.schema.string().min(1),
  name: tool.schema.string().min(1).max(128).optional(),
  metadata: tool.schema.record(tool.schema.string(), tool.schema.string()).optional(),
});

const spawnWorkerArgs = {
  models: tool.schema.array(modelSchema).min(1).max(maxModelsPerCohort),
  metadata: tool.schema.record(tool.schema.string(), tool.schema.string()).optional(),
  workerAgent: tool.schema.string().min(1).optional(),
  leaseSeconds: tool.schema.number().int().min(60).max(maxLeaseSeconds).optional(),
};

const listWorkersArgs = {
  states: tool.schema.array(tool.schema.enum(["running", "paused"])).optional(),
  metadata: tool.schema.record(tool.schema.string(), tool.schema.string()).optional(),
  cohortID: tool.schema.string().min(1).optional(),
};

const runTaskArgs = {
  workerID: tool.schema.string().min(1),
  task: tool.schema.string().min(1),
  title: tool.schema.string().min(1).max(128).optional(),
};

const listTasksArgs = {
  workerID: tool.schema.string().min(1).optional(),
  statuses: tool.schema.array(tool.schema.enum(["submitting", "submitted", "running", "completed", "failed"])).optional(),
};

const getTaskArgs = {
  taskID: tool.schema.string().min(1),
};

function required(value, name) {
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new Error(`${name} must be configured before spawning workers`);
}

function cliproxyConfig({ providerID, modelID, cliproxyUrl, cliproxyApiKey }) {
  return JSON.stringify({
    autoupdate: false,
    provider: {
      [providerID]: {
        npm: "@ai-sdk/openai-compatible",
        options: {
          apiKey: cliproxyApiKey,
          baseURL: cliproxyUrl,
          chunkTimeout: 30000,
          setCacheKey: true,
        },
        models: {
          [modelID]: {
            name: modelID,
          },
        },
      },
    },
    model: `${providerID}/${modelID}`,
  });
}

async function baseline(worktree) {
  const options = { cwd: worktree, encoding: "utf8" };
  const [{ stdout: commit }, { stdout: status }] = await Promise.all([
    execFile("git", ["rev-parse", "HEAD"], options),
    execFile("git", ["status", "--porcelain=v1", "--untracked-files=normal"], options),
  ]);

  if (status.trim()) {
    throw new Error("spawn_worker requires a clean Git worktree so every worker has the same baseline");
  }

  return { commit: commit.trim() };
}

function modelKey(model) {
  return `${model.providerID}/${model.modelID}`;
}

function networkFor(cliproxyUrl, restrictEgress) {
  if (!restrictEgress) return { allowPublicTraffic: true };

  const { hostname } = new URL(cliproxyUrl);
  return {
    allowPublicTraffic: false,
    allowOut: [hostname],
    denyOut: ["0.0.0.0/0"],
  };
}

async function responseJson(response, operation) {
  const text = await response.text();
  let body;

  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(`${operation} failed with HTTP ${response.status}`);
  }

  return body;
}

async function agentenvRequest(fetchImpl, agentenvUrl, apiKey, path, init = {}) {
  const url = new URL(path, `${agentenvUrl.replace(/\/$/, "")}/`);
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      "X-API-Key": apiKey,
      ...init.headers,
    },
  });

  return responseJson(response, `${init.method ?? "GET"} ${url.pathname}`);
}

function workerEnvironment(input) {
  return {
    OPENCODE_CONFIG_CONTENT: cliproxyConfig(input),
    OPENCODE_SERVER_PASSWORD: input.serverPassword,
    OPENCODE_WORKER_AGENT: input.workerAgent,
    OPENCODE_WORKER_ID: input.workerID,
    OPENCODE_WORKER_PORT: "4096",
  };
}

function workerFromSandbox(sandbox) {
  const metadata = sandbox.metadata ?? {};
  const [providerID, ...modelParts] = (metadata.opencodeAgentenvModel ?? "").split("/");
  const modelID = modelParts.join("/");
  const workerMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !key.startsWith("opencodeAgentenv")),
  );

  return {
    workerID: metadata.opencodeAgentenvWorker,
    name: metadata.opencodeAgentenvName,
    model: providerID && modelID ? { providerID, modelID } : undefined,
    metadata: workerMetadata,
    cohortID: metadata.opencodeAgentenvCohort,
    baselineCommit: metadata.opencodeAgentenvBaseline,
    sandboxID: sandbox.sandboxID,
    template: sandbox.alias,
    state: sandbox.state,
    startedAt: sandbox.startedAt,
    expiresAt: sandbox.endAt,
    resources: {
      cpuCount: sandbox.cpuCount,
      memoryMB: sandbox.memoryMB,
      diskSizeMB: sandbox.diskSizeMB,
    },
  };
}

function matchesWorker(worker, args) {
  if (args.cohortID && worker.cohortID !== args.cohortID) return false;
  if (args.states?.length && !args.states.includes(worker.state)) return false;

  return Object.entries(args.metadata ?? {}).every(([key, value]) => worker.metadata[key] === value);
}

async function loadState(path) {
  try {
    const state = JSON.parse(await readFile(path, "utf8"));
    return { version: 1, workers: {}, tasks: {}, ...state };
  } catch (error) {
    if (error?.code === "ENOENT") return { version: 1, workers: {}, tasks: {} };
    throw error;
  }
}

async function saveState(path, state) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

async function updateState(path, update) {
  const lockPath = `${path}.lock`;
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  let lock;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      lock = await open(lockPath, "wx", 0o600);
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  if (!lock) throw new Error("Timed out acquiring AgentENV worker state lock");

  try {
    const state = await loadState(path);
    await update(state);
    await saveState(path, state);
    return state;
  } finally {
    await lock.close();
    await unlink(lockPath).catch(() => undefined);
  }
}

function opencodeHeaders(agentenvApiKey, sandboxID, serverPassword) {
  return {
    "X-API-Key": agentenvApiKey,
    "x-agentenv-sandbox-id": sandboxID,
    "x-agentenv-target-port": "4096",
    Authorization: `Basic ${Buffer.from(`opencode:${serverPassword}`).toString("base64")}`,
  };
}

async function opencodeRequest(fetchImpl, agentenvUrl, headers, path, init = {}) {
  const url = new URL(path, `${agentenvUrl.replace(/\/$/, "")}/`);
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      ...headers,
      ...init.headers,
    },
  });

  return responseJson(response, `${init.method ?? "GET"} OpenCode ${path}`);
}

async function bootstrapWorkerServer(sandboxID) {
  await execFile("aenv", [
    "exec",
    sandboxID,
    "sh",
    "-lc",
    "pkill -x opencode || true; nohup opencode serve --hostname 0.0.0.0 --port 4096 >/tmp/opencode-worker.log 2>&1 </dev/null &",
  ], { encoding: "utf8" });
}

async function waitForWorkerHealth(fetchImpl, agentenvUrl, headers, signal) {
  let lastError;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const health = await opencodeRequest(fetchImpl, agentenvUrl, headers, "/global/health", { signal });
      if (health?.healthy) return health;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`OpenCode worker server did not become healthy${lastError ? `: ${lastError.message}` : ""}`);
}

function assistantText(response) {
  return (response.parts ?? [])
    .filter((part) => part.type === "text" && !part.ignored)
    .map((part) => part.text)
    .join("");
}

function taskResult(task, messages, statuses) {
  const sessionStatus = statuses?.[task.sessionID];
  if (sessionStatus?.type === "busy" || sessionStatus?.type === "retry") {
    return { ...task, status: "running", sessionStatus };
  }

  const response = [...(messages ?? [])].reverse().find((message) => message.info?.role === "assistant");
  if (!response) return { ...task, status: "submitted" };

  return {
    ...task,
    status: response.info.error ? "failed" : "completed",
    completedAt: response.info.time?.completed,
    text: assistantText(response),
    message: response.info,
  };
}

export default async (_input, options = {}) => {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    throw new Error("spawn_worker requires a Fetch implementation");
  }

  const agentenvUrl = options.agentenvUrl ?? process.env.AGENTENV_API_URL ?? "http://127.0.0.1:8080";
  const agentenvApiKey = options.agentenvApiKey ?? process.env.AGENTENV_API_KEY ?? "local";
  const workerTemplate = options.workerTemplate ?? process.env.AGENTENV_WORKER_TEMPLATE;
  const cliproxyUrl = options.cliproxyUrl ?? process.env.CLIPROXY_API_URL;
  const cliproxyApiKey = options.cliproxyApiKey ?? process.env.CLIPROXY_API_KEY;
  const restrictEgress = options.restrictEgress ?? process.env.AGENTENV_RESTRICT_EGRESS === "true";
  const credentialStore = options.credentialStore ?? process.env.AGENTENV_CREDENTIAL_STORE ?? join(homedir(), ".local", "state", "opencode", "agentenv-workers.json");
  const workerBootstrap = options.bootstrapWorker ?? bootstrapWorkerServer;
  const workerHealthCheck = options.waitForWorkerHealth ?? waitForWorkerHealth;
  const providerID = options.providerID ?? "cliproxy";

  return {
    tool: {
      list_workers: tool({
        description: "List AgentENV sandboxes created by spawn_worker. Returns normalized worker identity, model, tags, cohort, baseline, lifecycle state, expiration, and resources without exposing credentials. Use this to track workers before creating more or performing lifecycle operations.",
        args: listWorkersArgs,
        async execute(args) {
          const sandboxes = await agentenvRequest(fetchImpl, agentenvUrl, agentenvApiKey, "/v2/sandboxes");
          const workers = sandboxes
            .filter((sandbox) => sandbox.metadata?.opencodeAgentenvWorker)
            .map(workerFromSandbox)
            .filter((worker) => matchesWorker(worker, args));

          return {
            title: `Listed ${workers.length} worker${workers.length === 1 ? "" : "s"}`,
            output: JSON.stringify({ workers }, null, 2),
            metadata: { workers },
          };
        },
      }),
      list_tasks: tool({
        description: "List tasks submitted to AgentENV OpenCode workers. Refreshes remote session status without waiting and returns task IDs, workers, sessions, models, titles, submission times, and current status.",
        args: listTasksArgs,
        async execute(args) {
          const state = await loadState(credentialStore);
          const tasks = [];

          for (const task of Object.values(state.tasks)) {
            if (args.workerID && task.workerID !== args.workerID) continue;
            const credential = state.workers[task.workerID];
            let result = task;

            if (credential?.sandboxID === task.sandboxID) {
              const headers = opencodeHeaders(agentenvApiKey, task.sandboxID, credential.serverPassword);
              try {
                const statuses = await opencodeRequest(fetchImpl, agentenvUrl, headers, "/session/status");
                const sessionStatus = statuses?.[task.sessionID];
                const messages = sessionStatus?.type === "busy" || sessionStatus?.type === "retry"
                  ? undefined
                  : await opencodeRequest(fetchImpl, agentenvUrl, headers, `/session/${encodeURIComponent(task.sessionID)}/message`);
                result = taskResult(task, messages, statuses);
              } catch {
                result = { ...task, status: "failed", error: "Worker is unreachable" };
              }
            }

            if (!args.statuses?.length || args.statuses.includes(result.status)) tasks.push(result);
          }

          return {
            title: `Listed ${tasks.length} task${tasks.length === 1 ? "" : "s"}`,
            output: JSON.stringify({ tasks }, null, 2),
            metadata: { tasks },
          };
        },
      }),
      get_task: tool({
        description: "Read the current status and result of one previously submitted worker task. Returns immediately; completed tasks include final assistant text and message attribution.",
        args: getTaskArgs,
        async execute(args) {
          const state = await loadState(credentialStore);
          const task = state.tasks[args.taskID];
          if (!task) throw new Error(`Task ${args.taskID} is not known`);

          const credential = state.workers[task.workerID];
          if (!credential || credential.sandboxID !== task.sandboxID) {
            throw new Error(`Task ${args.taskID} has no matching worker credential`);
          }

          const headers = opencodeHeaders(agentenvApiKey, task.sandboxID, credential.serverPassword);
          const [statuses, messages] = await Promise.all([
            opencodeRequest(fetchImpl, agentenvUrl, headers, "/session/status"),
            opencodeRequest(fetchImpl, agentenvUrl, headers, `/session/${encodeURIComponent(task.sessionID)}/message`),
          ]);
          const result = taskResult(task, messages, statuses);

          return {
            title: `${result.status === "completed" ? "Completed" : "Task"}: ${result.title}`,
            output: JSON.stringify(result, null, 2),
            metadata: { taskID: task.taskID, workerID: task.workerID, sessionID: task.sessionID, status: result.status },
          };
        },
      }),
      run_task: tool({
        description: "Submit a task asynchronously to one running AgentENV OpenCode worker. Returns immediately with a durable taskID and remote sessionID; use get_task or list_tasks later to monitor and retrieve results.",
        args: runTaskArgs,
        async execute(args, context) {
          const sandboxes = await agentenvRequest(fetchImpl, agentenvUrl, agentenvApiKey, "/v2/sandboxes");
          const sandbox = sandboxes.find((candidate) => candidate.metadata?.opencodeAgentenvWorker === args.workerID);

          if (!sandbox) throw new Error(`Worker ${args.workerID} is not running or no longer exists`);
          if (sandbox.state !== "running") throw new Error(`Worker ${args.workerID} is ${sandbox.state}; resume it before running a task`);

          const state = await loadState(credentialStore);
          const credential = state.workers[args.workerID];
          if (!credential || credential.sandboxID !== sandbox.sandboxID) {
            throw new Error(`Worker ${args.workerID} has no matching local credential; spawn it from this OpenCode configuration`);
          }

          const worker = workerFromSandbox(sandbox);
          const headers = opencodeHeaders(agentenvApiKey, sandbox.sandboxID, credential.serverPassword);
          const health = await opencodeRequest(fetchImpl, agentenvUrl, headers, "/global/health", { signal: context.abort });
          if (!health?.healthy) throw new Error(`Worker ${args.workerID} OpenCode server is unhealthy`);

          const title = args.title ?? `Task for ${worker.name ?? worker.workerID}`;
          const session = await opencodeRequest(fetchImpl, agentenvUrl, headers, "/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
            signal: context.abort,
          });
          const task = {
            taskID: randomUUID(),
            workerID: worker.workerID,
            workerName: worker.name,
            sandboxID: worker.sandboxID,
            sessionID: session.id,
            title,
            model: worker.model,
            agent: credential.workerAgent,
            status: "submitting",
            createdAt: new Date().toISOString(),
          };
          await updateState(credentialStore, (current) => {
            current.tasks[task.taskID] = task;
          });

          try {
            await opencodeRequest(fetchImpl, agentenvUrl, headers, `/session/${encodeURIComponent(session.id)}/prompt_async`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                agent: credential.workerAgent,
                model: credential.model,
                parts: [{ type: "text", text: args.task }],
              }),
              signal: context.abort,
            });
            task.status = "submitted";
            task.submittedAt = new Date().toISOString();
          } catch (error) {
            task.status = "failed";
            task.error = error instanceof Error ? error.message : String(error);
            task.failedAt = new Date().toISOString();
            await updateState(credentialStore, (current) => {
              current.tasks[task.taskID] = task;
            });
            throw error;
          }

          await updateState(credentialStore, (current) => {
            current.tasks[task.taskID] = task;
          });

          context.metadata({
            title: `Submitted task to ${worker.name ?? worker.workerID}`,
            metadata: { taskID: task.taskID, workerID: task.workerID, sessionID: task.sessionID, model: task.model },
          });

          return {
            title: `Submitted task to ${worker.name ?? worker.workerID}`,
            output: JSON.stringify(task, null, 2),
            metadata: { taskID: task.taskID, workerID: task.workerID, sessionID: task.sessionID, model: task.model },
          };
        },
      }),
      spawn_worker: tool({
        description: "Spawn one isolated AgentENV OpenCode worker per selected model. The host worktree must be clean; all workers receive the same immutable Git baseline and Cliproxy configuration, while the requested model is explicitly selected per worker. Optional metadata is copied to each worker as tags.",
        args: spawnWorkerArgs,
        async execute(args, context) {
          const template = required(workerTemplate, "AGENTENV_WORKER_TEMPLATE or plugin workerTemplate");
          const proxyUrl = required(cliproxyUrl, "CLIPROXY_API_URL or plugin cliproxyUrl");
          const proxyApiKey = required(cliproxyApiKey, "CLIPROXY_API_KEY or plugin cliproxyApiKey");
          const duplicate = args.models.find((model, index) =>
            args.models.findIndex((candidate) => modelKey(candidate) === modelKey(model)) !== index,
          );

          if (duplicate) {
            throw new Error(`Each benchmark model must be unique; ${modelKey(duplicate)} was supplied more than once`);
          }

          if (args.models.some((model) => model.providerID !== providerID)) {
            throw new Error(`spawn_worker is configured for provider ${providerID}; all models must use that provider`);
          }

          const base = await baseline(context.worktree);
          const leaseSeconds = args.leaseSeconds ?? defaultLeaseSeconds;
          const cohortID = randomUUID();
          const workerAgent = args.workerAgent ?? "build";

          context.metadata({
            title: `Spawning ${args.models.length} worker${args.models.length === 1 ? "" : "s"}`,
            metadata: { cohortID, baselineCommit: base.commit, ...args.metadata },
          });

          await agentenvRequest(fetchImpl, agentenvUrl, agentenvApiKey, `/templates/${encodeURIComponent(template)}`);

          const spawnedCredentials = [];
          const workers = await Promise.all(
            args.models.map(async (model) => {
              const workerID = randomUUID();
              const serverPassword = randomBytes(32).toString("base64url");
              const request = {
                templateID: template,
                timeout: leaseSeconds,
                autoPause: false,
                secure: true,
                network: networkFor(proxyUrl, restrictEgress),
                metadata: {
                  ...args.metadata,
                  ...model.metadata,
                  opencodeAgentenvCohort: cohortID,
                  opencodeAgentenvWorker: workerID,
                  opencodeAgentenvName: model.name ?? modelKey(model),
                  opencodeAgentenvBaseline: base.commit,
                  opencodeAgentenvModel: modelKey(model),
                },
                envVars: workerEnvironment({
                  ...model,
                  cliproxyUrl: proxyUrl,
                  cliproxyApiKey: proxyApiKey,
                  serverPassword,
                  workerAgent,
                  workerID,
                }),
              };

              let sandbox;
              try {
                sandbox = await agentenvRequest(fetchImpl, agentenvUrl, agentenvApiKey, "/sandboxes", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(request),
                  signal: context.abort,
                });
                await workerBootstrap(sandbox.sandboxID);
                await workerHealthCheck(
                  fetchImpl,
                  agentenvUrl,
                  opencodeHeaders(agentenvApiKey, sandbox.sandboxID, serverPassword),
                  context.abort,
                );
                spawnedCredentials.push({
                  workerID,
                  sandboxID: sandbox.sandboxID,
                  serverPassword,
                  workerAgent,
                  model: { providerID: model.providerID, modelID: model.modelID },
                });

                return {
                  workerID,
                  name: model.name ?? modelKey(model),
                  model: { providerID: model.providerID, modelID: model.modelID },
                  metadata: { ...args.metadata, ...model.metadata },
                  status: "spawned",
                  sandboxID: sandbox.sandboxID,
                  expiresInSeconds: leaseSeconds,
                };
              } catch (error) {
                if (sandbox?.sandboxID) {
                  await agentenvRequest(fetchImpl, agentenvUrl, agentenvApiKey, `/sandboxes/${encodeURIComponent(sandbox.sandboxID)}`, {
                    method: "DELETE",
                  }).catch(() => undefined);
                }
                return {
                  workerID,
                  name: model.name ?? modelKey(model),
                  model: { providerID: model.providerID, modelID: model.modelID },
                  metadata: { ...args.metadata, ...model.metadata },
                  status: "failed",
                  error: error instanceof Error ? error.message : String(error),
                };
              }
            }),
          );

          if (spawnedCredentials.length) {
            await updateState(credentialStore, (state) => {
              for (const credential of spawnedCredentials) state.workers[credential.workerID] = credential;
            });
          }

          return {
            title: `Spawned ${workers.filter((worker) => worker.status === "spawned").length}/${workers.length} workers`,
            output: JSON.stringify({
              cohortID,
              metadata: args.metadata ?? {},
              baseline: base,
              workerAgent,
              workers,
              nextStep: "Workers are provisioned with an explicit model and sandbox-local Cliproxy credentials. run_task will verify the OpenCode server through the AgentENV proxy before submitting work.",
            }, null, 2),
            metadata: { cohortID, baselineCommit: base.commit, workers },
          };
        },
      }),
    },
  };
};
