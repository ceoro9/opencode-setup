# opencode-setup

Personal opencode configuration for human-directed agentic software development.

## Workflow

```text
challenge
    ↓
/deep-reason — compare solutions at a high level
    ↓
human selects a solution
    ↓
/deep-plan — create a focused execution plan
    ↓
/implement-cycle — implement, verify, and review once
    ↓
human accepts, refines, or changes direction
    ↓
/prepare-pr — evaluate final delivery readiness
```

The workflow separates **solution selection**, **execution planning**, **implementation**, and **readiness evaluation**. Agents can work autonomously inside each stage, but the human controls transitions between stages. This limits goal drift, prevents rejected alternatives from influencing implementation, and stops review feedback from expanding into an unapproved new cycle.

For straightforward work with a known solution, start at `/deep-plan` or `/implement-cycle`. Use `/deep-reason` only when materially different approaches require a decision.

## 1. Select a Solution

```text
/deep-reason <challenge>
```

`/deep-reason` produces a concise decision artifact with:

- the decision and material constraints
- 2–4 realistic options
- decision-relevant trade-offs
- a recommendation
- the exact choice requiring human confirmation

It stays at solution level. Repository inspection is limited to constraints that could change the decision; code details, exhaustive risks, and execution planning are excluded.

After reviewing the result, explicitly select a solution in the same session.

## 2. Plan Execution

```text
/deep-plan <task or selected solution>
```

`/deep-plan` inherits the selected solution and removes rejected-option details. It produces a concise, self-contained plan containing:

- goal
- scope
- codebase-aligned implementation approach
- 4–8 ordered tasks
- proportional verification
- genuine blockers, if any

The plan excludes speculative risks, generic checklists, and low-level implementation concerns. It becomes the canonical execution handoff; later implementation cycles use the plan instead of the earlier alternatives analysis.

Both `/deep-reason` and `/deep-plan` perform investigation in isolated sub-agent sessions while publishing their complete final artifacts verbatim into the main conversation. Tool activity does not pollute the implementation context.

## 3. Run an Implementation Cycle

Start the first cycle:

```text
/implement-cycle <task>
```

When a canonical plan exists, this is enough:

```text
/implement-cycle
```

One cycle:

1. Revalidates repository state and preserves existing user changes.
2. Implements the smallest complete solution within the plan.
3. Adds or updates meaningful tests.
4. Runs relevant verification.
5. Delegates the final change to independent code and test reviewers.
6. Validates and synthesizes reviewer findings.
7. Stops for human judgment without applying review feedback.

The cycle ends with a human decision package:

- **Scope** — requested outcome, delivered scope, exclusions, and preserved constraints.
- **Implementation** — changed behavior, affected components, and key decisions.
- **Verification** — checks, results, and remaining evidence gaps.
- **Readiness review** — combined code/test assessment and validated findings.
- **Decision options** — accept, refine, clarify direction, or obtain external verification.

## 4. Iterate Under Human Control

If refinement is needed, the cycle produces a self-contained refinement brief. Continue in the same session with:

```text
/implement-cycle
```

Prior plans, accepted findings, decisions, and unresolved work are carried forward automatically. Add notes only when changing or clarifying direction:

```text
/implement-cycle Keep the public API unchanged and do not add a dependency
```

Each invocation completes exactly one implementation and review cycle. The human decides whether another cycle is justified.

## 5. Evaluate PR Readiness

When the implementation is accepted:

```text
/prepare-pr
```

This is a separate delivery gate. It evaluates the complete change for scope coherence, unresolved findings, verification evidence, compatibility, migration, rollout, and documentation concerns. It prepares PR content but does not modify code or create the pull request.

## Commands

| Command | Purpose |
| --- | --- |
| `/deep-reason` | Compare realistic solutions and support a human technical decision. |
| `/deep-plan` | Convert a selected solution into a focused, codebase-aligned execution plan. |
| `/implement-cycle` | Complete one implementation, verification, and independent-review cycle. |
| `/implement-fast` | Implement a small, clear, low-risk change without a separate plan or independent review. |
| `/implement` | Implement and verify a normal change without independent reviewers. |
| `/fix` | Diagnose and fix a specific bug with regression verification. |
| `/review` | Perform a standalone read-only review of existing changes. |
| `/prepare-pr` | Evaluate final PR readiness and prepare PR content. |
| `/verify-deployment` | Verify pipeline and post-deployment status without changing remote systems. |

## Specialized Agents

| Agent | Responsibility |
| --- | --- |
| `code-architect-fast` | High-level solution comparison for `/deep-reason`; concise execution planning for `/deep-plan`. |
| `code-review-final` | Independent review of correctness, regressions, security, compatibility, scope, and maintainability. |
| `test-reviewer` | Independent evaluation of test quality and verification confidence. |
| `code-review-intermediate` | Complete-change readiness evaluation and PR content preparation. |

Specialized agents use default-deny, read-only permissions. Reviewers never fix their own findings. Their output is validated and synthesized before presentation to the human.

## Boundaries

- `/deep-reason` does not select a solution or plan execution.
- `/deep-plan` does not reopen a selected solution or prescribe low-level code edits.
- `/implement-cycle` ignores rejected alternatives and completes exactly one cycle.
- Review findings are not applied until the human starts another cycle.
- `/prepare-pr` does not create a PR.
- `/verify-deployment` does not deploy, roll back, or modify remote systems without explicit instruction.
