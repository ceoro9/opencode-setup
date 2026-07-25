---
description: Run final PR-readiness review and automatically create a pull request when validation passes.
agent: build
model: cliproxy/general
---

Prepare and create a pull request for the current completed change. Use this context when provided:

$ARGUMENTS

## Phase 1: Inspect

Before changing Git state:

1. Inspect repository status, current branch, upstream, remotes, recent commits, and the complete diff from the intended base branch.
2. Identify the files and commits belonging to the task. Preserve unrelated and pre-existing user changes.
3. Determine the base branch from repository conventions or tracking information. Ask only when it cannot be established safely.
4. Collect actual test, lint, type-check, build, and review results from the current session and repository state.

## Phase 2: Independent Readiness Review

Delegate the complete proposed change to `code-review-final` as the read-only final PR-readiness gate.

Provide:

- original task and accepted scope
- canonical plan when available
- complete branch or task diff
- base branch
- changed files and commits
- verification commands and exact results
- prior intermediate code-review and test-review findings and their disposition
- compatibility, migration, rollout, and known-risk context

Require a structured `ready` or `not ready` final verdict plus PR title, description, validation notes, risks, and rollback notes. Only this validated final-review verdict may open the PR-creation gate; intermediate review outcomes are advisory inputs.

Validate the reviewer's findings against the repository. If a material finding is rejected, explain why. Normalize the final verdict from validated evidence.

## Stop When Not Ready

If the validated verdict is `not ready`:

- do not commit, push, or create a pull request
- report blocking findings and verification gaps
- provide a focused next-cycle refinement brief

## Create the Pull Request When Ready

Invoking `/prepare-pr` conditionally authorizes the primary agent to perform the Git and GitHub operations in this section. The validated `ready` verdict is the mandatory quality gate, not the source of authorization.

1. Confirm the complete task diff contains only intended changes and no secrets, temporary files, debug code, or accidental artifacts.
2. Verify whether the current branch is a dedicated, task-coherent branch with only relevant commits and no existing unrelated pull request. Do not rely only on branch name.
3. If the current branch is protected, shared, unrelated, unsuitable for the task, or has an unsafe push destination, create and switch to a dedicated branch using repository conventions. Do not commit directly to protected branches.
4. Inspect both the working-tree diff and complete staged diff immediately before committing. Stage only intended files. If unrelated staged or unstaged user changes cannot be excluded without altering user-owned state, stop and ask the user.
5. Create a commit only when intended uncommitted changes remain. Use repository commit conventions and do not amend existing commits. If the complete task is already committed, validate those commits and proceed without creating another commit.
6. Verify the exact destination remote, repository, and remote branch before pushing. Push the dedicated branch explicitly without force and set upstream only when needed.
7. Create the pull request against the verified base branch using `gh`.
8. Use the readiness review's title and a description containing:
   - Summary
   - Motivation
   - Implementation
   - Testing
   - Risks
   - Rollback
9. Confirm the pull request exists and capture its canonical URL.

Do not merge, enable auto-merge, approve, deploy, or delete branches.

## Output

When created, report:

- verdict: `ready`
- branch and base branch
- commit created
- verification summary
- remaining non-blocking risks
- pull request URL for human review

The final line must be:

`Manual review: <pull request URL>`
