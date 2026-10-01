# 5. Plain Express 5 and Drizzle

Status: accepted

## Context

The service has four endpoints and one table.

## Decision

Use Express 5 without a framework on top. Middleware, the central error handler, the composition root and graceful shutdown are written by hand. Express 5 forwards rejected promises to the error handler, so route handlers have no try/catch.

Use Drizzle for persistence: the schema is TypeScript, row types are inferred, migrations are plain SQL, and there is no generated client or engine binary.

## Consequences

Less magic and fewer dependencies. Anything NestJS would give for free (modules, DI container, OpenAPI decorators) is either unnecessary at this size or done explicitly.
