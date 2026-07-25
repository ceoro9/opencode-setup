---
description: Evaluate a technical decision at a high level and publish a concise solution comparison into the main session.
agent: build
model: cliproxy/deep
---

Evaluate the following challenge before planning implementation:

$ARGUMENTS

Workflow:

1. Delegate the challenge to `code-architect-fast` as an isolated sub-agent in reasoning mode.
2. Give it the user goal, material constraints, and the concise decision contract below.
3. Wait for its final response.
4. Return that final response verbatim as your entire answer.

Do not summarize, rewrite, annotate, or add commentary. The returned analysis is the canonical decision artifact for human selection and later `/deep-plan` use.

Output:

1. Decision
2. Goal and material constraints
3. Viable options
4. Trade-off summary
5. Recommendation
6. Human choice required

Rules:

- Stay high-level and goal-focused.
- Inspect the repository only enough to verify constraints that could change the decision. Do not trace implementation details, enumerate files, or design the solution.
- Compare 2–4 materially different, realistic options. Omit theoretical or low-value alternatives.
- Evaluate only trade-offs that could influence the choice, such as correctness, delivery cost, maintainability, compatibility, security, performance, and operations.
- Mention at most three credible risks per option. A risk must have a plausible trigger, meaningful impact, and relevance to the current system.
- Do not invent speculative edge cases, hypothetical future requirements, or exhaustive unknowns.
- Include assumptions or unknowns only when they could change the recommendation; limit them to three.
- Recommend one option when evidence supports it and explain the recommendation briefly.
- Do not include implementation tasks, sequencing, code details, or verification plans. Those belong to `/deep-plan`.
- Keep the complete response concise: normally 500–900 words.
- Do not modify files or implement a solution.
