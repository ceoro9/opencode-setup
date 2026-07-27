---
description: Complete one autonomous implementation cycle, then obtain independent code and test reviews for human evaluation.
agent: build
model: cliproxy/general
---

Complete one implementation cycle.

User input for this cycle:

$ARGUMENTS

## Cycle Context

- On the first invocation, treat the user input as the original task.
- If a complete `/deep-plan` result exists earlier in the main conversation, treat it as the canonical and self-contained execution handoff for the task. Use its selected solution, scope, constraints, ordered tasks, risks, success criteria, and verification strategy as implementation input.
- Once a canonical plan exists, do not use the earlier `/deep-reason` alternatives analysis as implementation context. Ignore rejected options, comparative trade-offs, and non-selected risks.
- Consult the earlier reasoning artifact only if the canonical plan explicitly identifies a missing decision or repository evidence makes the selected solution infeasible or unsafe. Stop for human judgment instead of switching solutions.
- Revalidate repository state before editing because the plan describes intended outcomes, not guaranteed current code details.
- Do not require the user to paste or restate the plan. Do not replace it with a shorter summary.
- On later invocations in the same session, recover the original task, canonical selected-solution plan, prior cycle results, validated review findings, refinement brief, unresolved risks, and user decisions from the conversation history. Do not recover rejected solution details.
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
2. Capture the initial Git status and relevant diff as the cycle baseline. Record pre-existing changed files and overlapping modifications.
3. Investigate the relevant code, tests, configuration, call sites, and conventions.
4. Confirm the requested outcome, constraints, and acceptance criteria.
5. Form a short internal implementation plan.
6. Implement the smallest complete solution.
7. Add or update tests when they provide meaningful protection.
8. Run the narrowest relevant checks first, then broader tests, lint, formatting, and type checks when justified.
9. Inspect the cycle-specific diff for correctness, scope, and unintended changes.

Ask the user before implementation only when missing information materially changes behavior, compatibility, architecture, security, or risk.

## Phase 2: Independent Review

After implementation and verification are complete, delegate review concurrently when possible:

- `code-review-intermediate`: perform a focused cycle-level sanity review for correctness, regressions, scope, compatibility, security, and maintainability. Its verdict is advisory and cannot authorize PR creation.
- `test-reviewer`: review the changed behavior and tests for meaningful coverage, correctness, failure paths, and maintainability.

Give each reviewer:

- the original task
- the canonical selected-solution `/deep-plan` handoff when available; do not supply the full alternatives analysis
- relevant prior-cycle findings and user decisions
- additional user notes for the current cycle
- the intended behavior and acceptance criteria
- the cycle-specific patch: the diff between the cycle baseline captured in Phase 1 step 2 and the current state, and nothing else
- verification commands and results scoped to this cycle
- relevant constraints and known limitations

Reviewers evaluate only the hunks contained in the cycle-specific patch. Surrounding or pre-existing code may be consulted solely to understand behavior and established patterns, never as independent review material. If pre-existing uncommitted edits overlap the same files and cannot be separated cleanly, exclude them from the patch given to reviewers and disclose the overlapping files and the separation limitation instead of supplying the combined diff.

Reviewers must not modify files. Require their structured verdict and findings, preserve reviewer attribution, and validate each finding against the code before reporting it.

## Stop Condition

Do not apply review findings in the same cycle.

Stop after presenting the implementation and independent review. The user decides whether to:

- accept the result and continue to `/prepare-pr`
- run `/implement-cycle` again with no arguments to address the carried-forward findings
- run `/implement-cycle <additional notes>` to address the findings with new guidance
- request a different direction

## Human Decision Package

Present one coherent report designed for human judgment. Lead with the current scope and combined readiness verdict, then explain the implementation and review evidence supporting it.

### Scope

- original requested outcome
- scope implemented in this cycle
- acceptance criteria addressed
- explicit exclusions, deferred work, and constraints preserved
- any difference between requested and delivered scope

### Implementation

- behavior implemented or changed
- files and components affected
- key implementation decisions and why they were necessary
- relevant failure paths and edge cases handled

### Verification

- commands and checks run
- results
- behavior directly verified
- unverified behavior, unavailable environments, or pre-existing failures

### Independent Readiness Review

- combined verdict: `ready`, `refinement recommended`, or `refinement required`
- code review readiness assessment and recommendation
- test review readiness assessment and recommendation
- validated findings grouped into one coherent explanation of what prevents or supports acceptance
- rejected reviewer findings and why, when relevant

Do not merely concatenate reviewer outputs. Reconcile overlap, disagreement, and severity into a concise assessment that lets the human understand whether the current solution satisfies the requested goal and what remains to be done.

After validating reviewer findings, normalize each review outcome from the findings that remain valid. Rejected findings must not affect the combined verdict.

Determine the combined verdict using these rules:

- `refinement required` when any validated blocking or major finding remains.
- `refinement recommended` when no blocking or major finding remains but at least one validated minor material finding remains.
- `ready` only when no validated material finding remains and no material verification gap prevents confidence.

If normalization changes a reviewer's original verdict, state the original verdict, normalized outcome, and reason.

### Human Decision

End with the available choices and the evidence behind them:

- **Accept current solution** — use only when the combined verdict is `ready`.
- **Run another cycle** — state the exact refinement objective and why it matters.
- **Clarify direction** — identify the product, scope, architecture, or risk decision needed from the human.
- **Require external verification** — identify manual, environment-specific, or operational evidence still needed.

Do not make the decision on the human's behalf.

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

State `No additional implementation cycle is required.` only when the combined verdict is `ready`.

## Rules

- Keep implementation and review responsibilities separate.
- Do not ask reviewers to approve their own work.
- Ensure the final report clearly distinguishes requested scope, implemented scope, review evidence, and the decision still owned by the human.
- Do not expand scope based on non-blocking reviewer suggestions.
- Do not commit, push, create a PR, deploy, or modify remote systems unless explicitly requested.
