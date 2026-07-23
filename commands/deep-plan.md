---
description: Investigate a task deeply and produce an implementation-ready plan without changing code.
agent: code-architect-fast
model: cliproxy/deep
subtask: true
---

Analyze the following task and produce a concrete implementation plan:

$ARGUMENTS

Rules:

- Do not modify files or implement the solution.
- Inspect the relevant code, tests, configuration, and call sites.
- Verify assumptions before relying on them.
- Identify the root problem, constraints, affected components, edge cases, and risks.
- Resolve low-risk technical details from repository evidence.
- Ask only when an unresolved decision materially changes behavior, compatibility, architecture, security, or scope.

Output:

1. Verified context
2. Proposed approach and key decisions
3. Ordered implementation steps with file references
4. Verification strategy
5. Open decisions or risks
