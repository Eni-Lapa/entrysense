# 2. Model output is validated like user input

Status: accepted

## Context

Structured output from a model is usually right, but not always: values out of range, invented categories, missing fields, or no tool call at all.

## Decision

The extraction schema (`domain/model.ts`) is the single definition. It generates the JSON Schema the model sees and validates what comes back. Symptoms and moods are closed enums. On failure the exact validation issues go back to the model once as a `tool_result` error; a second failure returns `422 EXTRACTION_FAILED` and nothing is stored. The database enforces the same ranges with CHECK constraints, and rows are parsed on the way out as well.

## Consequences

Nothing unvalidated reaches storage or clients. Worst-case latency is two model calls. The eval tracks how often the retry is needed.
