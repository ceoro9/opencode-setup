---
description: Complete one autonomous implementation cycle, then obtain independent code and test reviews for human evaluation.
model: cliproxy/general
---

Complete one implementation cycle.

User input for this cycle:

$ARGUMENTS

## Cycle Context

- On the first invocation, treat the user input as the original task.
- On later invocations in the same session, recover the original task, prior cycle results, validated review findings, refinement brief, unresolved risks, and user decisions from the conversation history.
- Treat new user input as additional notes, changed constraints, accepted or rejected findings, or a request to continue. Do not require the user to repeat or paste prior findings.
- Build the current cycle scope from the accumulated context. Latest explicit user instructions take precedence over earlier cycle notes.
- Carry unresolved accepted findings forward until implemented, rejected by the user, or proven invalid.
- If no prior cycle exists in the current session, require enough user input to establish the task.

## Cycle Contract

The cycle has two separate phases:

1. Implementation by the primary agent.
2. Independent review by read-only sub-agents.

Complete exactly one cycle. Do not automatically begin another implementation cycle after review.

## Phase 1: Implement and Verify

1. Inspect repository state and preserve pre-existing user changes.
2. Investigate the relevant code, tests, configuration, call sites, and conventions.
3. Confirm the requested outcome, constraints, and acceptance criteria.
4. Form a short internal implementation plan.
5. Implement the smallest complete solution.
6. Add or update tests when they provide meaningful protection.
7. Run the narrowest relevant checks first, then broader tests, lint, formatting, and type checks when justified.
8. Inspect the final diff for correctness, scope, and unintended changes.

Ask the user before implementation only when missing information materially changes behavior, compatibility, architecture, security, or risk.

## Phase 2: Independent Review

After implementation and verification are complete, delegate review concurrently when possible:

- `code-review-final`: review the complete task diff for correctness, regressions, scope, complexity, consistency, security, and maintainability.
- `test-reviewer`: review the changed behavior and tests for meaningful coverage, correctness, failure paths, and maintainability.

Give each reviewer:

- the original task
- relevant prior-cycle findings and user decisions
- additional user notes for the current cycle
- the intended behavior and acceptance criteria
- the complete set of files changed by this cycle
- verification commands and results
- relevant constraints and known limitations

Reviewers must not modify files. Treat their conclusions as independent evidence and validate each finding against the code before reporting it.

## Stop Condition

Do not apply review findings in the same cycle.

Stop after presenting the implementation and independent review. The user decides whether to:

- accept the result and continue to `/prepare-pr`
- run `/implement-cycle` again with no arguments to address the carried-forward findings
- run `/implement-cycle <additional notes>` to address the findings with new guidance
- request a different direction

## Output

### Cycle Result

- requested outcome
- behavior implemented
- files changed
- key decisions

### Verification

- commands and checks run
- results
- unverified behavior or pre-existing failures

### Independent Review

- verdict: `ready`, `refinement recommended`, or `refinement required`
- validated code-review findings
- validated test-review findings
- rejected reviewer findings and why, when relevant

### Next-Cycle Refinement Brief

If refinement is recommended or required, provide a self-contained brief containing:

- objective
- blocking or accepted findings to address
- required behavior
- affected files or components
- acceptance criteria
- verification requirements
- constraints and behavior that must remain unchanged

Retain this brief as session context for the next `/implement-cycle`; the user must not need to paste it back. Merge any new user notes into it on the next invocation.

If no refinement is needed, state: `No additional implementation cycle is required.`

## Rules

- Keep implementation and review responsibilities separate.
- Do not ask reviewers to approve their own work.
- Do not expand scope based on non-blocking reviewer suggestions.
- Do not commit, push, create a PR, deploy, or modify remote systems unless explicitly requested.
