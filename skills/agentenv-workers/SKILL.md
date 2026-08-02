---
name: agentenv-workers
description: Use when delegating implementation, research, verification, or review to isolated AgentENV OpenCode workers, including multi-model benchmark comparisons.
---

# AgentENV Worker Delegation

The default `facilitator` primary agent owns the core worker-management loop. Use this skill for detailed `list_workers`, `spawn_worker`, `run_task`, `list_tasks`, and `get_task` contracts, metadata conventions, model routing, and benchmark procedures. Workers perform repository work inside AgentENV; the facilitator remains host read-only.

## Management Loop

The facilitator owns worker lifecycle. Before spawning, call `list_workers` to understand current capacity, avoid duplicates, and find reusable workers by name, cohort, model, state, or tags. After spawning, preserve each `workerID` and `sandboxID`, monitor expiration, and list again before reporting worker state.

Use metadata consistently so workers remain discoverable. Prefer `purpose`, `task`, `issue`, `candidate`, `attempt`, and `ownerSession`. Use `cohortID` returned by `spawn_worker` to group workers created together.

Do not assume a worker is alive, paused, or expired from conversation history. Query `list_workers`. Do not create replacement workers until checking whether a suitable worker already exists.

## `list_workers` Contract

Call without arguments for all plugin-managed workers, or filter by `states`, `cohortID`, and metadata tags:

```json
{
  "states": ["running"],
  "cohortID": "cohort-id",
  "metadata": {
    "purpose": "benchmark"
  }
}
```

The result includes worker and sandbox IDs, name, model, user metadata, cohort, baseline commit, template, state, expiration, and resources. It excludes unmanaged AgentENV sandboxes and internal metadata keys.

## `run_task` Contract

Use `run_task` after selecting a running worker by `workerID`:

```json
{
  "workerID": "worker-id",
  "title": "Implement parser fix",
  "task": "Inspect the parser failure, implement the smallest correct fix, add regression coverage, and run the relevant checks."
}
```

The plugin reuses the worker's assigned model and agent; do not pass or change them during task execution. It creates a dedicated remote OpenCode session, submits asynchronously, and immediately returns a durable `taskID` plus `sessionID`.

Give each worker a complete, bounded task brief containing the objective, acceptance criteria, constraints, expected artifacts, and verification. Workers do not inherit the facilitator's conversation context. For benchmarks, send byte-identical task text to every candidate worker.

Use `list_tasks` to monitor multiple submitted tasks without waiting. Use `get_task` with a `taskID` when a result is needed. A task may be `submitting`, `submitted`, `running`, `completed`, or `failed`. Do useful coordination work while tasks run; do not repeatedly poll without a reason.

After completion, assess the returned text as worker-reported evidence. Preserve `taskID` and `sessionID`; do not claim implementation correctness until patch collection and independent verification exist.

## When to Spawn Workers

Spawn a worker when the work is independent, needs isolated execution, benefits from a second implementation or review, or is explicitly a model comparison.

Do not spawn a worker for a tiny answer, when the task needs immediate user clarification, or when workers would edit the same candidate state.

Use one worker for focused investigation or a single implementation. Use two or more only for materially different approaches, independent verification, or model benchmarking.

## Choosing Models

The facilitator chooses every worker's model explicitly from the configured `cliproxy` model IDs. User-specified model choices or restrictions override automatic routing; never invent an unconfigured model name.

Choose models by work type:

- `cliproxy/fast`: quick exploration, narrow searches, simple mechanical checks.
- `cliproxy/general`: ordinary implementation, debugging, and routine verification.
- `cliproxy/smart`: complex implementation, ambiguous defects, multi-file design, or detailed review.
- `cliproxy/deep`: difficult architecture, high-risk reasoning, or final comparison of competing approaches.

These are default routing heuristics, not benchmark labels. If the user supplies exact model IDs, use those exact IDs. For a fair benchmark, keep the worker agent, baseline, prompt, permissions, resources, and timeout identical; vary only `modelID`.

## `spawn_worker` Contract

Pass one entry per worker in `models`. Each entry must use the configured `cliproxy` provider and a unique model ID.

```json
{
  "workerAgent": "build",
  "metadata": {
    "purpose": "implementation",
    "issue": "123"
  },
  "models": [
    {
      "providerID": "cliproxy",
      "modelID": "general",
      "name": "implementation-general"
    },
    {
      "providerID": "cliproxy",
      "modelID": "smart",
      "name": "implementation-smart",
      "metadata": {
        "candidate": "alternative"
      }
    }
  ]
}
```

- `workerID` is generated by the plugin. Preserve it for follow-up operations.
- The clean host Git repository is bundled once and cloned at the exact baseline commit into `/workspace/repo` for every worker. Workers edit only that isolated checkout.
- `name` is an optional human-readable identifier. Use a stable, role-based name.
- Top-level `metadata` is copied to every worker.
- Per-model `metadata` is copied only to that worker and overrides matching top-level keys.
- Metadata values must be strings. Use tags such as `purpose`, `task`, `candidate`, `benchmark`, `attempt`, or issue identifiers.
- Treat model identity as operational metadata, not as an instruction to the worker.

## Required Preconditions

Before calling `spawn_worker`:

1. Call `list_workers` and verify that a suitable worker or duplicate cohort does not already exist.
2. Confirm the host Git worktree is clean. The tool rejects dirty worktrees to guarantee a common baseline.
3. Confirm the task is sufficiently bounded and workers will not overlap on mutable state.
4. Select only configured model IDs and honor any user-specified restrictions.
5. Choose the worker agent deliberately; default `build` is for execution, not review-only work.
6. Use descriptive names and tags so results can be identified later.

A worker may fail while others succeed. Keep successful worker IDs and assess failures separately. Do not expose provider credentials; the plugin injects sandbox-local credentials and redacts AgentENV failure details.

## Benchmark Pattern

A benchmark is a normal multi-worker request with common tags:

```json
{
  "workerAgent": "build",
  "metadata": {
    "purpose": "benchmark",
    "case": "parser-fix-01",
    "attempt": "1"
  },
  "models": [
    { "providerID": "cliproxy", "modelID": "general", "name": "parser-general" },
    { "providerID": "cliproxy", "modelID": "smart", "name": "parser-smart" }
  ]
}
```

Do not mention competing models in the task prompt. Compare only after each worker has independently completed the same bounded task.

## Current Limit

Worker listing, creation, asynchronous task submission, and task result retrieval are available now. Pause, resume, timeout extension, deletion, and `collect_patch` are not implemented yet. The facilitator must track workers and task IDs, inspect task status at decision points, and report material completion, failure, or blockers to the human. Worker results are reports, not trusted host-side patches or verification results.
