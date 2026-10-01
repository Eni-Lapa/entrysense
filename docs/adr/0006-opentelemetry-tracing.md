# 6. OpenTelemetry for request and model-call tracing

Status: accepted

## Context

The interesting latency and cost in this service sit inside model calls, which are invisible in ordinary request logs. Traces should work with any backend (a local Jaeger, an OpenTelemetry Collector, a commercial APM) without code changes.

## Decision

Use the OpenTelemetry API throughout and start the SDK only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, exporting OTLP over HTTP/protobuf. Without it the API is a no-op.

- The HTTP layer opens a SERVER span per request, named by route template, and continues an incoming W3C `traceparent`. Health probes are not traced.
- `OtelTracer` implements the existing `Tracer` port and records one CLIENT span per model call, as a child of the request span, using the GenAI semantic conventions (`gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.usage.*`) plus the estimated cost.
- Log lines carry `trace_id` and `span_id`, so logs and traces link both ways.
- Prompt and completion content is never put on spans. Notes are health data.
- Langfuse stays available beside it through a fan-out tracer, for prompt-level debugging when content tracing is explicitly enabled.

No auto-instrumentation is loaded: in an ES module app it needs a loader hook, and the two spans that matter here are cheaper to write by hand than to configure.

## Consequences

A trace shows each request, its model calls, their tokens and their cost. Pointing it at a different backend is environment only. The GenAI conventions are still incubating, so their attribute names are pinned in one file and may need renaming when they stabilise. Database spans are not recorded; adding `@opentelemetry/instrumentation-pg` with a loader hook is the next step if queries become interesting.
