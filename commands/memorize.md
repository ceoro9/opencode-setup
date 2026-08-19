---
description: Store explicitly supplied, non-secret facts as OpenViking long-term memory.
agent: build
model: cliproxy/general
---

Memorize the following for future OpenCode sessions:

$ARGUMENTS

Rules:

- Store only the facts explicitly supplied in `$ARGUMENTS`.
- Do not store credentials, API keys, tokens, passwords, private keys, raw configuration, or other secrets.
- Condense the supplied facts into a concise, durable memory without inventing details.
- Use the `openviking_remember` MCP tool exactly once.
- Memory indexing is asynchronous: do not immediately search or verify the stored memory.
- If the tool is unavailable or the identity cannot write tenant-scoped memory, report the exact blocker and do not use a root key or `--sudo` fallback.

Briefly state the concise summary stored and that it will become searchable after indexing.
