---
description: Verify a recently merged change reached a final deployment state and report evidence.
model: cliproxy/general
---

Verify the deployment for the following change or environment:

$ARGUMENTS

Rules:

- Do not modify code, trigger deployment, rollback, or change remote systems unless explicitly requested.
- Identify the relevant merge, pipeline, deployment target, and expected outcome from available evidence.
- Monitor the pipeline until it reaches a final state when access allows.
- If deployment succeeds, perform available health, version, endpoint, infrastructure, or log checks relevant to the change.
- If deployment fails, identify the failed stage and likely root cause without applying fixes.
- State exactly which checks could not be performed and why.

Output:

1. Deployment status
2. Evidence and checks performed
3. Failure details or remaining verification gaps
4. Recommended next action
