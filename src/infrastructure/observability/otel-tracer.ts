import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import type { GenerationRecord, Tracer } from "../../application/ports/tracer.js";

// OpenTelemetry GenAI semantic conventions. They are still marked incubating, so the
// names are pinned here rather than imported from the unstable entry point.
const GEN_AI_OPERATION_NAME = "gen_ai.operation.name";
const GEN_AI_PROVIDER_NAME = "gen_ai.provider.name";
const GEN_AI_REQUEST_MODEL = "gen_ai.request.model";
const GEN_AI_USAGE_INPUT_TOKENS = "gen_ai.usage.input_tokens";
const GEN_AI_USAGE_OUTPUT_TOKENS = "gen_ai.usage.output_tokens";

const tracer = trace.getTracer("entrysense-llm");

/**
 * One CLIENT span per model call, recorded after the call with its real start and
 * end times. It becomes a child of whatever span is active (the HTTP request), so a
 * trace shows each model call and its cost inside the request that caused it.
 * Prompt and completion content is never attached.
 */
export class OtelTracer implements Tracer {
  recordGeneration(r: GenerationRecord): void {
    const span = tracer.startSpan(`chat ${r.model}`, {
      kind: SpanKind.CLIENT,
      startTime: r.startTime,
      attributes: {
        [GEN_AI_OPERATION_NAME]: "chat",
        [GEN_AI_PROVIDER_NAME]: r.provider,
        [GEN_AI_REQUEST_MODEL]: r.model,
        [GEN_AI_USAGE_INPUT_TOKENS]: r.usage.inputTokens,
        [GEN_AI_USAGE_OUTPUT_TOKENS]: r.usage.outputTokens,
        "entrysense.operation": r.operation,
        "entrysense.llm.cost_usd": r.costUsd,
      },
    });
    if (r.error !== undefined) {
      span.setAttribute("error.type", "llm_call_failed");
      span.setStatus({ code: SpanStatusCode.ERROR, message: r.error });
    }
    span.end(r.endTime);
  }

  shutdown(): Promise<void> {
    return Promise.resolve(); // the SDK owns the exporter and flushes it
  }
}
