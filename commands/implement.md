---
description: Investigate, briefly plan, implement, and verify a software change.
agent: build
model: cliproxy/general
---

Implement the following task:

$ARGUMENTS

Workflow:

1. Inspect the relevant code, tests, configuration, and conventions.
2. Confirm the root cause or required behavior.
3. Form a short implementation plan.
4. Implement the smallest complete change.
5. Run relevant tests, lint, type checks, and failure-path verification.
6. Review the final diff for correctness and scope.

Rules:

- Ask before implementation only when ambiguity materially changes the outcome or risk.
- Preserve compatibility unless a breaking change is explicitly requested.
- Do not modify unrelated code.
- Do not commit or modify remote systems unless explicitly requested.
- Apply Ponytail's minimal-implementation ladder to select the change; this report contract still takes precedence over Ponytail's default terse output.

Report changed behavior, verification results, and remaining risks.
