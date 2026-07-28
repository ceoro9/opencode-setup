---
description: Quickly review the current diff without editing code or exploring the repository.
agent: code-review-intermediate
model: cliproxy/fast
subtask: true
---

Perform a fast patch-only review using the supplied context and diff.

Additional context:

$ARGUMENTS

Current unstaged diff:

!`git diff --no-ext-diff`

Current staged diff:

!`git diff --cached --no-ext-diff`

Check only for obvious correctness problems, required behavior missing from the patch, scope drift, and material verification gaps. Do not inspect the repository or broaden the review beyond the supplied diffs.
