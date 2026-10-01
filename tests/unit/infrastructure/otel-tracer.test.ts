import { SpanStatusCode } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";
import type { GenerationRecord, Tracer } from "../../../src/application/ports/tracer.js";
import { fanOut } from "../../../src/infrastructure/observability/fan-out-tracer.js";
import { OtelTracer } from "../../../src/infrastructure/observability/otel-tracer.js";
import { installInMemoryTracing } from "../../support/otel.js";

const exporter = installInMemoryTracing();

const record: GenerationRecord = {
  operation: "chat",
  provider: "anthropic",
  model: "claude-haiku-4-5",
  input: {},
  output: {},
  usage: { inputTokens: 120, outputTokens: 30 },
  costUsd: 0.00027,
  startTime: new Date("2026-09-30T10:00:00.000Z"),
  endTime: new Date("2026-09-30T10:00:01.250Z"),
};

describe("OtelTracer", () => {
  it("records a GenAI client span with the call's real timing and usage", () => {
    exporter.reset();
    new OtelTracer().recordGeneration(record);

    const [span] = exporter.getFinishedSpans();
    expect(span?.name).toBe("chat claude-haiku-4-5");
    expect(span?.attributes).toMatchObject({
      "gen_ai.provider.name": "anthropic",
      "gen_ai.request.model": "claude-haiku-4-5",
      "gen_ai.usage.input_tokens": 120,
      "gen_ai.usage.output_tokens": 30,
      "entrysense.llm.cost_usd": 0.00027,
    });
    expect(span?.duration).toEqual([1, 250_000_000]);
  });

  it("marks failed calls as errors", () => {
    exporter.reset();
    new OtelTracer().recordGeneration({ ...record, error: "overloaded" });

    const [span] = exporter.getFinishedSpans();
    expect(span?.status).toEqual({ code: SpanStatusCode.ERROR, message: "overloaded" });
  });
});

describe("fanOut", () => {
  it("forwards every record and shutdown to each tracer", async () => {
    const seen: string[] = [];
    const spy = (name: string): Tracer => ({
      recordGeneration: () => seen.push(`${name}:record`),
      shutdown: () => {
        seen.push(`${name}:shutdown`);
        return Promise.resolve();
      },
    });

    const tracer = fanOut([spy("a"), spy("b")]);
    tracer.recordGeneration(record);
    await tracer.shutdown();

    expect(seen).toEqual(["a:record", "b:record", "a:shutdown", "b:shutdown"]);
  });
});
