---
description: Implement a focused change immediately with minimal investigation and verification.
agent: build
model: cliproxy/general
---

Implement the following request:

$ARGUMENTS

Rules:

- Start implementation after inspecting only the context required to change the code safely.
- Do not create a separate plan or delegate planning unless blocked by material ambiguity.
- Make the smallest complete change that follows existing patterns.
- Do not perform unrelated cleanup, refactoring, or architectural work.
- Run the narrowest relevant tests, lint, and type checks available.
- Fix failures caused by the change; distinguish pre-existing failures.
- Apply Ponytail's minimal-implementation ladder to select the change; this report contract still takes precedence over Ponytail's default terse output.

Report only:

- changed behavior
- verification performed
- blockers or remaining risks
