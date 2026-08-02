import { execFile as execFileCallback } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
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

              try {
                const sandbox = await agentenvRequest(fetchImpl, agentenvUrl, agentenvApiKey, "/sandboxes", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(request),
                  signal: context.abort,
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
