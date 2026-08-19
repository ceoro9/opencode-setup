---
description: Complete one bounded implementation cycle, with independent review only when explicitly requested or concretely high risk.
agent: build
model: cliproxy/general
---

Complete one implementation cycle for:

$ARGUMENTS

## Context

- Treat a complete earlier `/deep-plan` result as the canonical execution handoff. Follow its selected solution, scope, constraints, acceptance criteria, and verification strategy.
- On later invocations, use the latest compact cycle checkpoint plus subsequent user decisions. Do not reconstruct or restate every earlier cycle report.
- Treat new arguments as the task on the first invocation and as changed constraints or additional guidance on later invocations.
- Revalidate repository state before editing. Ask only when missing information materially changes behavior, compatibility, architecture, security, or scope.
- Apply Ponytail's minimal-implementation ladder to select the change; this command's Implement, Fast Drift Check, and Report contracts take precedence over Ponytail's default terse output.

## Implement

1. Inspect repository state and preserve pre-existing user changes.
2. Inspect only the code, tests, configuration, call sites, and conventions needed for safe implementation.
3. Form a short internal plan.
4. Implement the complete requested outcome or canonical plan when it is cohesive and practical within this run. Do not artificially limit the cycle to one plan item or the smallest possible patch.
5. Keep the solution minimal in design and scope, not incomplete in behavior.
6. Add or update tests when they provide meaningful protection.
7. Run focused verification first, then broader tests, lint, formatting, and type checks when justified.
8. Inspect the task-specific diff for correctness, scope, and unintended changes.

Stop implementation only when blocked by a material decision, unavailable required evidence, or a task too broad to complete safely in one run. In that case, finish the largest cohesive verified portion and state the exact remainder.

## Fast Drift Check

A cycle review is a brief alignment check, not an independent code or test audit. `/prepare-pr` remains the final complete-change review gate.

Run `code-review-intermediate` only when:

- the user explicitly requests a cycle review, or
- the completed patch changes authentication, authorization, security, privacy, payments, migrations, persisted data, concurrency, infrastructure, dependencies, or a public API.

Compute the task-specific patch once. Give the reviewer only:

- the current cycle objective or relevant canonical-plan excerpt
- current acceptance criteria and constraints
- the task-specific patch
- exact verification results

Do not provide the whole task history, earlier cycle patches, broad architecture context, or unrelated files. The reviewer is tool-free and must judge only the supplied material. Do not invoke `test-reviewer` during implementation cycles.

Validate any finding against the patch before reporting it. Do not apply findings in the same cycle; preserve human control over whether refinement is warranted.

## Report

Keep the result concise and proportional to the work:

1. **Changed behavior** — completed scope, important exclusions, and affected components.
2. **Verification** — checks run, results, and material gaps.
3. **Readiness** — `ready`, `refinement recommended`, `refinement required`, or `blocked`; include review findings only when review ran.

When work or accepted findings remain, end with a compact **Next-cycle checkpoint** containing only:

- objective
- remaining required work or validated findings
- constraints that must remain unchanged
- acceptance and verification needed

Omit the checkpoint when the requested outcome is complete and ready. State whether the optional drift check ran.

Do not commit, push, create a pull request, deploy, or modify remote systems unless explicitly requested.
