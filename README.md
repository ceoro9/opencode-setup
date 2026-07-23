# opencode-setup

Personal opencode configuration built around human-controlled implementation cycles.

## Core Workflow

The default workflow is:

```text
request → implement and verify → independent review → human decision
```

Start an autonomous cycle with:

```text
/implement-cycle <task>
```

Continue the same task in the same session with:

```text
/implement-cycle
```

Or add guidance for the next cycle:

```text
/implement-cycle <additional notes>
```

During one cycle, the primary agent:

1. Investigates the task and repository context.
2. Forms a short implementation plan.
3. Implements the smallest complete solution.
4. Adds or updates relevant tests.
5. Runs available verification.
6. Delegates the final diff to independent code and test reviewers.
7. Validates their findings and presents the result without applying review feedback.

The cycle then stops. The human decides the next action:

- **Ready:** run `/prepare-pr`.
- **Refinement needed:** run `/implement-cycle` again. Prior findings are carried forward automatically.
- **Refinement with guidance:** run `/implement-cycle <additional notes>`.
- **Direction is wrong:** provide new constraints or use `/deep-reason` before another cycle.

The review boundary is intentional: the implementation agent does not silently fix reviewer findings. Each cycle produces one inspectable implementation iteration and one explicit decision point.

## Iterating Across Cycles

A cycle that needs more work ends with a self-contained refinement brief containing:

- objective
- findings to address
- required behavior
- affected files or components
- acceptance criteria
- verification requirements
- behavior and constraints that must remain unchanged

The next invocation automatically uses the original task, prior implementation results, validated findings, unresolved risks, refinement brief, and user decisions from the current session:

```text
/implement-cycle
```

Add notes only when you want to change priorities, clarify behavior, accept or reject a finding, or constrain the next solution:

```text
/implement-cycle Fix the blocking findings, but keep the public API unchanged and do not add a dependency
```

New notes are merged with the carried-forward context; they do not replace it. The latest explicit user instruction wins when notes conflict.

Repeat until the independent review reports that no additional implementation cycle is required. Continue cycles in the same opencode session so conversation context remains available. Do not start a new cycle for optional cleanup or unrelated improvements unless you explicitly want them included.

## Daily Commands

Commands are selected by the outcome you need. Use the narrowest workflow that fits the task.

| Command | Use when | Result |
| --- | --- | --- |
| `/implement-cycle` | You want one complete implementation, verification, and independent-review iteration before making the next decision. | Implemented and verified changes, independent review, and a next-cycle refinement brief when needed. |
| `/deep-plan` | A task is complex, crosses multiple components, or needs investigation before implementation. | An implementation-ready plan. No code changes. |
| `/deep-reason` | You need to understand a technical challenge, compare approaches, or make an architectural decision. | Options, trade-offs, and a recommendation. No code changes. |
| `/implement-fast` | The request is focused, low-risk, and sufficiently clear to implement immediately without an independent review cycle. | A minimal implementation with focused verification. |
| `/implement` | You need implementation and verification but do not need independent reviewers. | A complete, verified implementation using the standard workflow. |
| `/fix` | A specific bug or regression needs diagnosis and repair outside the full cycle workflow. | Root-cause analysis, a focused fix, and regression verification. |
| `/review` | Existing changes need a standalone quality review. | Evidence-based findings. No code changes. |
| `/prepare-pr` | Implementation cycles are complete and the changes need a final readiness decision and PR description. | Readiness verdict, blockers, PR title, summary, and validation notes. |
| `/verify-deployment` | A merged change needs pipeline and post-deployment validation. | Deployment status, evidence, verification gaps, and next action. |

## Choosing a Command

Use this decision path:

1. Want the standard autonomous implementation loop?
   - Run `/implement-cycle`.
2. Need analysis without implementation?
   - Need an actionable implementation plan: `/deep-plan`
   - Need options and a technical decision: `/deep-reason`
3. Need code changes without independent review?
   - Small, clear, low-risk change: `/implement-fast`
   - Normal feature or change: `/implement`
   - Known bug or regression: `/fix`
4. Implementation already exists?
   - Need standalone code-quality feedback: `/review`
   - Need final PR readiness: `/prepare-pr`
   - Change is already merged: `/verify-deployment`

## Examples

```text
/implement-cycle Add CSV export to the transactions page
/deep-plan Add organization-level roles to the authorization system
/deep-reason Should this service use polling, webhooks, or a message queue?
/implement-fast Rename the button label and update its UI test
/implement Add a development-only diagnostics endpoint
/fix Users are logged out when refreshing an expired access token
/review Focus on error handling and backward compatibility
/prepare-pr Prepare the current branch for PR against main
/verify-deployment Verify the deployment of PR #123 in production
```

## Workflow Boundaries

- `/implement-cycle` completes exactly one implementation and review iteration, then stops for human judgment.
- Later `/implement-cycle` invocations in the same session automatically inherit the original task, prior findings, refinement brief, and user decisions.
- Independent reviewers used by `/implement-cycle` are read-only and do not fix their own findings.
- `/deep-plan` and `/deep-reason` never implement changes.
- `/review` reports findings but does not fix them.
- `/prepare-pr` evaluates readiness but does not create a PR unless explicitly requested.
- `/verify-deployment` observes and verifies; it does not deploy, roll back, or modify remote systems unless explicitly requested.
- `/implement-fast` skips a separate planning phase and independent review, but still inspects essential context and runs focused verification.
