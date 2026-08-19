---
description: Extract and store durable non-secret knowledge from the current session in OpenViking.
agent: build
model: cliproxy/general
---

Create one concise long-term OpenViking memory from this current session.

Rules:

- Extract only stable facts, decisions, preferences, operational constraints, and completed setup details that will materially help future sessions.
- Exclude temporary progress, unverified claims, failed attempts, speculation, credentials, API keys, tokens, passwords, private keys, raw configuration, and other secrets.
- Do not invent or infer facts not established in the session.
- If there is no durable knowledge worth preserving, say so and do not write memory.
- Otherwise, use `openviking_remember` exactly once with a concise structured summary.
- Memory indexing is asynchronous: do not immediately search or verify the stored memory.
- If the tool is unavailable or the identity cannot write tenant-scoped memory, report the exact blocker. Do not use a root key or `--sudo` fallback.

Briefly state the concise summary stored and that it will become searchable after indexing.
