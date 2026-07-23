---
description: Evaluate implementation readiness for pull request.
mode: subagent
model: cliproxy/general
---

# Prepare PR Workflow

Your goal is to evaluate whether the current implementation is ready for a pull request.

This workflow is a quality gate.

Do not automatically modify the implementation.

Your responsibility is to analyze risks and help decide whether another implementation iteration is required.

---

# Step 1: Analyze Current Changes

Inspect the current git changes.

Understand:

- what was changed
- which behavior was introduced or modified
- whether the diff is focused
- whether unrelated changes exist

Do not make changes at this stage.

---

# Step 2: Run Final Code Review

Delegate the current changes to:

`code-review-final`

The reviewer should independently evaluate:

- unnecessary complexity
- maintainability risks
- consistency with the codebase
- readability problems
- questionable abstractions
- unnecessary dependencies

Collect the findings.

Do not apply fixes automatically.

---

# Step 3: Run Test Review

Delegate test changes to:

`test-reviewer`

Evaluate:

- whether tests provide sufficient confidence
- whether important scenarios are covered
- whether tests follow existing patterns
- whether tests are maintainable

Collect the findings.

Do not modify tests automatically.

---

# Step 4: Analyze Findings

Review all findings from:

- code-review-final
- test-reviewer

For each finding determine:

- Is this a real issue?
- How important is it?
- Does it block creating a PR?
- Can it be addressed later?

Classify findings:

## Blocking

Requires another implementation iteration.

Examples:

- incorrect behavior
- significant maintainability issue
- unnecessary complexity affecting future changes
- missing important test coverage

## Non-blocking

Can be accepted.

Examples:

- minor naming concerns
- stylistic differences
- small improvements
- optional refactoring

---

# Step 5: Make a Decision

Do not fix code automatically.

Provide a recommendation:

## Ready for PR

Use when:

- no blocking issues remain
- implementation quality is acceptable
- remaining findings are minor

## Needs Another Implementation Cycle

Use when:

- important issues were found
- the implementation should be changed
- another `/implement-fast` iteration is needed

Explain exactly why.

---

# Step 6: Prepare PR Information

If the change is ready:

Provide:

## Summary

What changed and why.

## Validation

Tests and checks performed.

## Review Result

- findings from reviewers
- accepted findings
- resolved concerns

## Remaining Notes

Only include important context for reviewers.

Create a PR with tools you have available and attach the following information.

---

# Important Rule

Do not confuse review with implementation.

Your role at this stage is to evaluate readiness, not to silently improve the code.

When changes are required, return to the implementation workflow.
