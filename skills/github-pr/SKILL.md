---
name: github-pr
description: Prepare high-quality pull requests following the team's review and deployment standards.
---

# Pull Request Standards

Use this skill whenever preparing or reviewing a Pull Request.

The objective is to produce a PR that reviewers can understand quickly and merge with confidence.

---

# Before Creating a PR

Verify:

- implementation is complete
- relevant tests passed
- lint passed (if applicable)
- git diff contains only intended changes
- no debug code remains
- no unrelated refactoring was introduced

If any verification cannot be performed, clearly state it.

---

# Pull Request Structure

Always generate PR descriptions using the following structure.

## Summary

Briefly describe what changed.

## Motivation

Explain why the change was needed.

## Implementation

Describe the chosen implementation approach.

Mention important design decisions.

## Testing

List verification steps.

Examples:

- unit tests
- integration tests
- manual testing
- local verification

Do not claim tests passed unless they were actually executed.

## Risks

Describe:

- potential regressions
- edge cases
- deployment considerations

If no significant risks are identified, explicitly state that.

## Rollback

Describe how the change can be safely reverted if required.

---

# Reviewer Expectations

Help reviewers understand:

- what changed
- why it changed
- where they should focus attention
- possible tradeoffs
- assumptions made

Avoid unnecessary implementation details.

---

# Large Pull Requests

If the change is large:

- recommend splitting it into smaller PRs when practical
- identify independent logical changes

---

# Deployment Awareness

When the change affects:

- infrastructure
- databases
- AWS resources
- configuration
- feature flags

Include deployment considerations.

Mention:

- migration requirements
- rollback strategy
- operational risks

---

# Final Verification

Before declaring the PR ready:

Review:

- git diff
- changed files
- commit messages
- tests performed

Confirm:

- no accidental files
- no generated artifacts unless intended
- no secrets
- no temporary debugging code

---

# Output

Produce:

- complete PR description
- review checklist
- deployment notes (if applicable)
- rollback notes (if applicable)

Do not invent verification results.

Clearly distinguish:

- verified facts
- assumptions
- recommendations
