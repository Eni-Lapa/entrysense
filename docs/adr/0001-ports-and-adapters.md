# 1. Ports and adapters with an enforced dependency rule

Status: accepted

## Context

The service talks to two things that are expensive or slow to use in tests: a language model and a database. Both are likely to change (another model provider, another store).

## Decision

Split the code into four layers. `domain` holds pure types and calculations. `application` holds the use cases and the ports they need (`LlmProvider`, `EntryRepository`, `Clock`, `Tracer`). `infrastructure` holds the adapters. `http` is the transport. `container.ts` is the only module that picks concrete implementations.

Dependencies point inwards. This is enforced with `no-restricted-imports` rules in `eslint.config.js`, so a violation fails CI rather than code review.

Use cases raise errors with transport-neutral codes. The HTTP layer owns its own codes (auth, routing, payload size) and the mapping from codes to status codes.

## Consequences

Use cases are tested with a scripted provider and an in-memory repository, with no network and no database. Swapping the model provider is a new adapter plus one line in the container. The cost is a little more indirection than a single-folder Express app.
