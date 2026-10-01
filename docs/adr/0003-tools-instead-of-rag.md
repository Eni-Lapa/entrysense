# 3. Tool calling over SQL instead of retrieval

Status: accepted

## Context

Questions like "how did I sleep last week?" need aggregates over structured rows.

## Decision

`/chat` runs a tool-calling loop with two tools, `search_entries` and `get_trends`, backed by the repository and the pure trends functions. Tool arguments are validated before execution, and invalid arguments are returned to the model as errors. The loop is capped at five steps.

## Consequences

Answers are exact and cheap: no embeddings, no vector store. The cap bounds cost and latency per request, and exceeding it is a typed `502 TOOL_LOOP_LIMIT`. Retrieval would be the right choice for unstructured free text, which this service does not need to search.
