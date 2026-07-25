---
description: Publish a concise, codebase-aligned execution plan for a selected solution into the main session.
agent: build
model: cliproxy/deep
---

Plan the execution of:

$ARGUMENTS

Workflow:

1. Recover the latest `/deep-reason` result and human-selected solution when they exist.
2. If materially different solutions remain unresolved, ask the human to choose before planning.
3. Build a focused brief containing only the selected solution, user goal, confirmed constraints, and later human notes.
4. Delegate planning to `code-architect-fast` as an isolated sub-agent.
5. Return the planner's final response verbatim as your entire answer.

Do not summarize, rewrite, annotate, or add commentary. The returned plan is the canonical execution handoff for `/implement-cycle`.

Output:

1. Goal
2. Scope
3. Implementation approach
4. Ordered tasks
5. Verification
6. Blockers, if any

Rules:

- Stay focused on delivering the requested outcome within the selected solution.
- Align the plan with existing codebase architecture, conventions, utilities, and test strategy.
- Inspect enough repository context to avoid proposing work the codebase does not need.
- Prefer adapting existing patterns over introducing new structures.
- Provide 4–8 ordered, outcome-focused tasks. For each task, state what must change and the observable result.
- Include constraints only when they are confirmed by the user, repository, or selected solution and materially affect execution.
- Include a blocker only when implementation cannot proceed safely or correctly without resolving it.
- Include risks only inside the relevant task and only when they are immediate, credible, and likely to affect implementation or acceptance.
- Do not create standalone risk, mitigation, assumptions, edge-case, compatibility, security, logging, observability, rollout, or operational checklists unless the task explicitly requires them.
- Do not speculate about hypothetical failures, future requirements, or low-level implementation concerns before code is written.
- Do not prescribe log messages, field-level validation, secret handling details, error wording, internal helper structure, or other code-level mechanics unless they are central to the requested behavior.
- Keep verification proportional: identify the few tests or checks that prove the requested behavior and protect important existing behavior.
- Avoid code snippets, line-level edits, exhaustive file lists, and investigation narration.
- Keep the complete plan concise, normally 400–800 words.
- Do not modify files or implement the solution.
