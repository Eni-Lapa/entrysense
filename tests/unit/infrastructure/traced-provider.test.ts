import { pino } from "pino";
import { describe, expect, it } from "vitest";
import type { LlmProvider } from "../../../src/application/ports/llm-provider.js";
import type { GenerationRecord, Tracer } from "../../../src/application/ports/tracer.js";
import { estimateCostUsd } from "../../../src/infrastructure/llm/pricing.js";
import { TracedProvider } from "../../../src/infrastructure/llm/traced-provider.js";
import { ScriptedProvider, text } from "../../support/scripted-provider.js";

class RecordingTracer implements Tracer {
  readonly records: GenerationRecord[] = [];
  recordGeneration(record: GenerationRecord) {
    this.records.push(record);
  }
  shutdown() {
    return Promise.resolve();
  }
}

const request = { operation: "chat", system: "", messages: [], maxTokens: 1 };
const logger = pino({ level: "silent" });

describe("TracedProvider", () => {
  it("records one generation per call and passes the response through", async () => {
    const tracer = new RecordingTracer();
    const traced = new TracedProvider(new ScriptedProvider([[text("hi")]]), tracer, logger);

    const response = await traced.complete(request);

    expect(response.content).toEqual([text("hi")]);
    expect(tracer.records).toEqual([
      expect.objectContaining({ operation: "chat", provider: "scripted", usage: { inputTokens: 10, outputTokens: 5 } }),
    ]);
  });

  it("keeps note content out of traces unless explicitly enabled", async () => {
    const withMessages = {
      ...request,
      messages: [{ role: "user" as const, content: [text("I had a migraine")] }],
      context: { traceId: "req-9" },
    };
    const redacted = new RecordingTracer();
    const full = new RecordingTracer();

    await new TracedProvider(new ScriptedProvider([[text("ok")]]), redacted, logger).complete(withMessages);
    await new TracedProvider(new ScriptedProvider([[text("ok")]]), full, logger, { includeContent: true }).complete(
      withMessages,
    );

    expect(JSON.stringify(redacted.records)).not.toContain("migraine");
    expect(redacted.records[0]).toMatchObject({
      traceId: "req-9",
      input: { messages: 1 },
      output: { blocks: ["text"] },
    });
    expect(JSON.stringify(full.records)).toContain("migraine");
  });

  it("records failures and rethrows them unchanged", async () => {
    const tracer = new RecordingTracer();
    const failure = new Error("boom");
    const failing: LlmProvider = { name: "x", model: "y", complete: () => Promise.reject(failure) };

    await expect(new TracedProvider(failing, tracer, logger).complete(request)).rejects.toBe(failure);
    expect(tracer.records[0]).toMatchObject({ error: "boom", costUsd: 0 });
  });
});

describe("estimateCostUsd", () => {
  it("prices known models per million tokens and treats unknown models as free", () => {
    expect(estimateCostUsd("claude-haiku-4-5-20251001", { inputTokens: 1_000_000, outputTokens: 200_000 })).toBe(2);
    expect(estimateCostUsd("some-other-model", { inputTokens: 1000, outputTokens: 1000 })).toBe(0);
  });
});
