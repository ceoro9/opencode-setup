---
name: git
description: Safely work with Git repositories using the project's GitFlow workflow, branch naming conventions and commit standards.
---

# Purpose

Use this skill whenever working with Git.

This includes:

- creating branches
- checking repository status
- staging changes
- creating commits
- suggesting Git commands
- switching branches
- synchronizing with remote
- resolving merge conflicts
- rebasing
- reverting changes

---

# Workflow

Follow GitFlow.

Protected branches:

- main
- master
- develop

Never commit directly to a protected branch.

Always create a dedicated working branch.

Branch prefixes:

- feature/
- bugfix/
- hotfix/
- release/
- chore/

Examples:

feature/EWS-1234-add-price-cache

bugfix/EWS-1456-fix-null-price

hotfix/EWS-1501-fix-production-timeout

Branch names should:

- clearly describe the purpose
- use lowercase words
- use hyphens
- be concise
- include the ticket identifier when available

---

# Repository inspection

Before suggesting Git commands, inspect the repository.

Prefer running:

git status

git branch

git remote -v

git log --oneline -10

Determine:

- current branch
- staged changes
- unstaged changes
- untracked files
- upstream branch
- whether local branch is behind or ahead

Never assume repository state.

---

# Commit messages

Follow Conventional Commits.

Format:

<type>(optional-scope): summary

Allowed types:

- feat
- fix
- refactor
- perf
- test
- docs
- build
- ci
- style
- chore
- revert

Examples:

feat(catalog): add cache invalidation

fix(api): preserve latest valid price

refactor(product): simplify event mapping

test(catalog): add regression tests

docs: update deployment guide

Rules:

- imperative mood
- lowercase summary
- no trailing period
- first line under 72 characters
- describe what changed, not what was done

Never generate commit messages before inspecting the actual Git diff.

Commit messages must accurately reflect staged changes.

---

# Git commands

Prefer modern Git commands.

Use:

git switch

instead of:

git checkout

when appropriate.

Examples:

Create feature branch:

git switch develop

git pull

git switch -c feature/EWS-1234-add-price-cache

Stage files:

git add <files>

or

git add .

Commit:

git commit -m "feat(catalog): add cache invalidation"

Push:

git push -u origin feature/EWS-1234-add-price-cache

---

# Safety

Prefer non-destructive operations.

Never recommend:

git push --force

unless explicitly requested.

Never recommend:

git reset --hard

unless explicitly requested.

Prefer safer alternatives such as:

git restore

git revert

git stash

Before suggesting destructive commands:

- explain the consequences
- suggest a safer option first

Always preserve local work whenever possible.

---

# Merge and rebase

Prefer keeping history clean.

When updating a feature branch:

- fetch latest changes
- recommend rebase when appropriate
- resolve conflicts carefully

Avoid unnecessary merge commits.

---

# General principles

Always inspect before acting.

Never assume repository state.

Never invent commit messages.

Prefer explicit commands.

Choose the safest workflow whenever multiple options exist.
