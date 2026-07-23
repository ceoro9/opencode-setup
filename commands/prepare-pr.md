---
description: Evaluate whether current changes are ready for a pull request and prepare PR content without fixing code.
model: cliproxy/smart
---

Evaluate the current changes for pull-request readiness. Use this context when provided:

$ARGUMENTS

Rules:

- Do not modify files or create a pull request unless explicitly requested.
- Inspect repository status, the complete diff, relevant tests, and validation results.
- Check correctness, scope, compatibility, maintainability, security, and test confidence.
- Distinguish blocking issues from non-blocking observations.
- Do not treat personal style preferences as findings.

Output:

1. Verdict: ready or not ready
2. Blocking findings with file references
3. Non-blocking risks or verification gaps
4. Proposed PR title
5. Concise PR summary and validation notes
