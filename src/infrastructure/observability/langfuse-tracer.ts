import { Langfuse } from "langfuse";
import type { GenerationRecord, Tracer } from "../../application/ports/tracer.js";

export class LangfuseTracer implements Tracer {
  private readonly client: Langfuse;

  constructor(options: { publicKey: string; secretKey: string; baseUrl: string }) {
    this.client = new Langfuse(options);
  }

  recordGeneration(r: GenerationRecord): void {
    // trace() upserts by id, so every call made for one request lands in the same trace.
    this.client.trace({ ...(r.traceId !== undefined && { id: r.traceId }), name: r.operation }).generation({
      name: r.operation,
      model: r.model,
      input: r.input,
      output: r.output,
      startTime: r.startTime,
      endTime: r.endTime,
      usageDetails: { input: r.usage.inputTokens, output: r.usage.outputTokens },
      costDetails: { total: r.costUsd },
      metadata: { provider: r.provider, requestId: r.requestId },
      ...(r.error !== undefined && { level: "ERROR" as const, statusMessage: r.error }),
    });
  }

  async shutdown(): Promise<void> {
    await this.client.shutdownAsync();
  }
}
