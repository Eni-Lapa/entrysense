import type { Logger } from "pino";
import type { CompletionRequest, CompletionResponse, LlmProvider } from "../../application/ports/llm-provider.js";
import type { Tracer } from "../../application/ports/tracer.js";
import { estimateCostUsd } from "./pricing.js";

export interface TracingOptions {
  /**
   * Send prompts and completions to the tracer. Off by default: notes are health
   * data, and only metadata (tokens, latency, cost) should leave the service unless
   * the operator opts in.
   */
  includeContent: boolean;
}

/** Decorator that records latency, tokens and cost for every call. */
export class TracedProvider implements LlmProvider {
  constructor(
    private readonly inner: LlmProvider,
    private readonly tracer: Tracer,
    private readonly logger: Logger,
    private readonly options: TracingOptions = { includeContent: false },
  ) {}

  get name(): string {
    return this.inner.name;
  }

  get model(): string {
    return this.inner.model;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = new Date();
    const base = {
      operation: request.operation,
      provider: this.name,
      model: this.model,
      input: this.options.includeContent ? request.messages : { messages: request.messages.length },
      startTime,
      ...(request.context?.traceId !== undefined && { traceId: request.context.traceId }),
      ...(request.context?.requestId !== undefined && { requestId: request.context.requestId }),
    };

    try {
      const response = await this.inner.complete(request);
      const endTime = new Date();
      const costUsd = estimateCostUsd(response.model, response.usage);
      this.tracer.recordGeneration({
        ...base,
        model: response.model,
        output: this.options.includeContent ? response.content : { blocks: response.content.map((b) => b.type) },
        usage: response.usage,
        costUsd,
        endTime,
      });
      this.logger.info(
        {
          operation: request.operation,
          requestId: request.context?.requestId,
          traceId: request.context?.traceId,
          model: response.model,
          latencyMs: endTime.getTime() - startTime.getTime(),
          ...response.usage,
          costUsd,
        },
        "llm call",
      );
      return response;
    } catch (error) {
      this.tracer.recordGeneration({
        ...base,
        output: null,
        usage: { inputTokens: 0, outputTokens: 0 },
        costUsd: 0,
        endTime: new Date(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
