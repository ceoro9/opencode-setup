---
description: Reproduce, diagnose, and fix a specific bug with focused regression verification.
model: cliproxy/general
---

Fix the following bug:

$ARGUMENTS

Workflow:

1. Reproduce the issue or trace the failing execution path.
2. Identify and verify the narrowest root cause.
3. Implement the smallest safe fix.
4. Add or update a regression test when it provides meaningful protection.
5. Run focused verification, then broader checks when justified by risk.
6. Review the diff for unintended behavior changes.

Rules:

- Do not mask symptoms when the root cause can be fixed within scope.
- Do not perform unrelated cleanup or refactoring.
- Preserve existing behavior outside the bug unless explicitly requested.

Report the root cause, changed behavior, verification, and remaining risk.
