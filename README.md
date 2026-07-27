# opencode-setup

Personal opencode configuration for human-directed agentic software development.

The setup separates solution selection, execution planning, implementation, independent review, and delivery readiness. Agents work autonomously within each stage; the human controls transitions to prevent goal drift and unapproved iteration.

## Philosophy

AI agents are effective at bounded technical work, but long autonomous runs compound assumptions. An agent may remain locally consistent while gradually solving a different problem, expanding scope, or treating its own implementation choices as requirements.

This workflow controls that risk through explicit boundaries:

- **Reason before planning** when the solution is unclear. The agent compares options, but the human chooses the direction.
- **Plan only the selected solution.** Rejected alternatives are removed from implementation context so they do not distract or influence later work.
- **Implement in bounded cycles.** Each cycle completes meaningful work, verification, and review, then stops instead of continuing automatically.
- **Use independent review.** Read-only reviewers evaluate code and test readiness without inheriting ownership of the implementation or fixing their own findings.
- **Keep decisions human-controlled.** The human accepts the result, starts another cycle, adds constraints, or changes direction.
- **Evaluate delivery separately.** A technically correct implementation still passes a final PR-readiness gate for scope, evidence, and delivery concerns.

The approach works by combining agent autonomy with frequent, evidence-based checkpoints. Agents retain enough freedom to investigate and implement efficiently, while humans retain authority over intent, trade-offs, scope, and acceptance.

## Workflow

```mermaid
flowchart TD
    Start([Task or challenge]) --> Known{Solution known?}

    Known -- No --> Reason["/deep-reason"]
    Reason --> Select{Human selects solution}
    Select --> Plan["/deep-plan"]

    Known -- Yes --> NeedPlan{Need a plan?}
    NeedPlan -- Yes --> Plan
    NeedPlan -- No --> Cycle["/implement-cycle"]
    Plan --> Cycle

    Cycle --> Decision{Human decision}
    Decision -- Refactor --> Refactor["/refactor-cycle"]
    Refactor --> RefactorDecision{Human decision}
    RefactorDecision -- Refine --> Refactor
    RefactorDecision -- Resume implementation --> Cycle
    Decision -- Refine --> Cycle
    Decision -- Add guidance --> Notes["/implement-cycle &lt;notes&gt;"]
    Notes --> Cycle
    Decision -- Change direction --> Reason
    Decision -- Accept --> Prepare["/prepare-pr"]

    Prepare --> Ready{Final review passes?}
    Ready -- No --> Cycle
    Ready -- Yes --> PR([Create PR automatically])
    PR --> Manual([Human reviews PR link])
    Manual --> Deploy["/verify-deployment"]

    Start -. small change .-> Fast["/implement-fast"]
    Start -. normal change without review .-> Implement["/implement"]
    Start -. bug .-> Fix["/fix"]
    Start -. existing changes .-> Review["/review"]
```

The main path is `/deep-reason` → human selection → `/deep-plan` → `/implement-cycle` → human decision → `/prepare-pr`. Shorter paths are available when reasoning, planning, or independent review is unnecessary.

## Core Handoffs

- `/deep-reason` stays high-level: decision, material constraints, realistic options, trade-offs, recommendation, and human choice. It does not plan execution.
- `/deep-plan` keeps only the selected solution and produces a concise, codebase-aligned plan: goal, scope, approach, 4–8 tasks, proportional verification, and genuine blockers.
- The plan supersedes rejected alternatives as implementation context. `/implement-cycle` revalidates repository details but does not reopen the selected solution unless it proves infeasible or unsafe.
- Each `/implement-cycle` completes exactly one implementation and risk-proportionate review iteration, then stops for human judgment. Low-risk patches receive focused verification and diff inspection; medium-risk patches receive code review; high-risk patches receive concurrent code and test review.
- `/refactor-cycle` delegates a behavior-preserving cleanup pass to an isolated refactoring agent. The agent receives no task or cycle context and works only from local code, tests, and conventions, focusing on simplicity, style, consistency, and elegance.

## Cycle Result

Every cycle presents one human decision package:

- **Scope** — requested and delivered scope, exclusions, and preserved constraints.
- **Implementation** — changed behavior, affected components, and key decisions.
- **Verification** — checks, results, and evidence gaps.
- **Risk tier and review** — stated low/medium/high classification, review path, synthesized findings, and advisory verdict.
- **Next action** — accept, refine, clarify direction, or obtain external verification.

`/implement-cycle` selects review depth from the completed patch: low-risk changes use focused verification and diff inspection, medium-risk changes add isolated code review, and high-risk changes add concurrent code and test review. These reviews are advisory and never authorize PR creation. When the human accepts the cycle result, invoking `/prepare-pr` conditionally authorizes the delivery workflow. It delegates the complete change to `code-review-final`, and only that validated final `ready` verdict opens the gate to validate or create a dedicated branch, commit remaining intended changes, push to a verified destination, create the pull request, and return its URL for manual review. A failing final verdict creates no Git or remote changes and sends the work back to another cycle.

If another cycle is needed, prior plans, accepted findings, decisions, and unresolved work carry forward automatically in the same session:

```text
/implement-cycle
/implement-cycle Keep the public API unchanged and do not add a dependency
```

Review findings are never applied automatically; the human decides whether another cycle is justified.

## Commands

| Command | Purpose |
| --- | --- |
| `/deep-reason` | Compare solutions and support a human technical decision. |
| `/deep-plan` | Convert the selected solution into a focused execution plan. |
| `/implement-cycle` | Complete one implementation, verification, and independent-review cycle. |
| `/refactor-cycle` | Delegate an isolated behavior-preserving refactor focused on code simplicity and elegance. |
| `/implement-fast` | Implement a small, clear, low-risk change directly. |
| `/implement` | Implement and verify without independent reviewers. |
| `/fix` | Diagnose and fix a bug with regression verification. |
| `/review` | Perform a standalone read-only code review. |
| `/prepare-pr` | Run final readiness review and automatically create the PR when it passes. |
| `/verify-deployment` | Verify pipeline and deployment state without changing remote systems. |

## Agents

| Agent | Responsibility |
| --- | --- |
| `code-architect-fast` | High-level reasoning and concise execution planning. |
| `code-review-intermediate` | Fast, advisory sanity review for implementation cycles and `/review`; never authorizes PR creation. |
| `test-reviewer` | Independent test and verification review during implementation cycles. |
| `refactor` | Isolated behavior-preserving refactoring for simplicity, style, consistency, and elegance. |
| `code-review-final` | Final complete-change readiness gate and PR content; its validated `ready` verdict is required for PR creation. |

Specialized agents use default-deny permissions. Reviewers are read-only and never fix their own findings; the isolated `refactor` agent may make only behavior-preserving local cleanup changes. Intermediate verdicts guide cycle decisions; only the final reviewer gates PR creation.

## Boundaries

- Human selection is required before planning when materially different solutions remain.
- Reasoning and planning never implement changes.
- Implementation ignores rejected alternatives after a canonical plan exists.
- Intermediate code/test reviews are advisory and cannot authorize PR creation.
- `/prepare-pr` creates a PR only after a validated `ready` verdict from `code-review-final`; it never merges or enables auto-merge.
- The created PR URL is returned to the human for manual review.
- `/verify-deployment` does not deploy, roll back, or modify remote systems without explicit instruction.
