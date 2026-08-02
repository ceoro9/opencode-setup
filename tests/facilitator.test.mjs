import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "jsonc-parser";

test("facilitator is the default read-only worker manager", async () => {
  const config = parse(await readFile("opencode.jsonc", "utf8"));
  const agent = await readFile("agents/facilitator.md", "utf8");

  assert.equal(config.default_agent, "facilitator");
  assert.match(agent, /^mode: primary$/m);
  assert.match(agent, /^model: cliproxy\/general$/m);
  assert.match(agent, /^  "\*": deny$/m);
  assert.match(agent, /^  task: deny$/m);
  assert.match(agent, /^  list_workers: allow$/m);
  assert.match(agent, /^  spawn_worker: allow$/m);
  assert.match(agent, /^  run_task: allow$/m);
  assert.match(agent, /^  list_tasks: allow$/m);
  assert.match(agent, /^  get_task: allow$/m);
  assert.doesNotMatch(agent, /^  edit: allow$/m);
  assert.doesNotMatch(agent, /^  bash: allow$/m);
});

test("facilitator treats AgentENV workers as persistent asynchronous collaborators", async () => {
  const agent = await readFile("agents/facilitator.md", "utf8");

  assert.match(agent, /AgentENV workers are your execution environment and first-class collaborators/);
  assert.match(agent, /Call `list_workers` before deciding to spawn/);
  assert.match(agent, /Treat `run_task` as asynchronous/);
  assert.match(agent, /Preserve every `workerID`, `taskID`, and `sessionID`/);
  assert.match(agent, /Do not busy-poll/);
  assert.match(agent, /Worker text is worker-reported evidence/);
});
