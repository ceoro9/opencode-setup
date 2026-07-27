---
description: Delegate an isolated, behavior-preserving code-simplicity refactor between implementation cycles.
agent: build
model: cliproxy/general
---

Delegate one refactoring pass to the `refactor` subagent.

Additional local focus, if supplied:

$ARGUMENTS

## Delegation Contract

1. Launch `refactor` as an isolated subagent.
2. Give it only the additional local focus above. Do not provide or ask it to recover the original task, plan, acceptance criteria, review findings, conversation history, or any other task-specific context.
3. The subagent determines safe scope solely from the current repository state, code, tests, configuration, and project conventions.
4. The subagent may edit code, but it must preserve observable behavior and may not change public APIs, outputs, configuration, persistence formats, dependencies, or architecture.
5. The subagent must not commit, push, create pull requests, deploy, or modify remote systems.
6. Wait for the subagent's final result and return it verbatim as your entire response.

Do not independently inspect, reinterpret, supplement, review, or summarize the refactor. Do not invoke other reviewers or begin an implementation cycle. The isolated subagent's report is the complete result of `/refactor-cycle`.
