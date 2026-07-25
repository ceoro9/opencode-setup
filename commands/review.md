---
description: Review current changes for correctness, regressions, scope, and maintainability without editing code.
agent: code-review-intermediate
model: cliproxy/smart
subtask: true
---

Review the current implementation. Use this additional context when provided:

$ARGUMENTS

Rules:

- Do not modify files.
- Inspect the current diff and relevant surrounding code.
- Focus findings on changes introduced by the current work.
- Check correctness, failure paths, regressions, compatibility, security, unnecessary complexity, project consistency, and missing tests.
- Report only actionable, evidence-based findings.
- Do not raise style preferences or unrelated legacy issues.

Order findings by severity and include file and line references. If no material issues are found, state that explicitly and note any verification gaps.
