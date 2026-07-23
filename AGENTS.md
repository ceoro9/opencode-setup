# Personal AI Coding Guidelines

## Communication

- Be concise and technical.
- Do not praise solutions unless there is a specific reason.
- Challenge assumptions.
- Prefer direct answers over explanations of obvious things.

## Engineering Principles   

- Prefer simple solutions over abstractions.
- Do not introduce new dependencies without justification.
- Reuse existing utilities and patterns.
- Avoid premature generalization.
- Question every new layer, wrapper, or helper.

## Code Review Style

When reviewing code:
- Focus on correctness and maintainability.
- Look for hidden complexity.
- Look for unnecessary code.
- Consider long-term impact.
- Do not comment on formatting unless it affects readability.

## Implementation Style

Before modifying code:
- Understand existing architecture.
- Search for similar implementations.
- Follow existing project conventions.

When implementing:
- Make the smallest reasonable change.
- Avoid unrelated refactoring.
- Add tests for important behavior.

## Backend Preferences

- Prefer explicit data flow over magic.
- Keep business logic separated from infrastructure.
- Handle errors intentionally.
- Consider retries, idempotency, and failure scenarios.

## Git workflow

Before making changes:
- Always inspect current git status.
- Read relevant existing code before editing.
- Prefer modifying existing files over creating new ones.

Before finishing:
- Review git diff.
- Check that only intended files changed.
- Mention any assumptions made.