import Anthropic from "@anthropic-ai/sdk";
import { LlmUnavailableError } from "../../application/errors.js";
import type {
  CompletionRequest,
  CompletionResponse,
  ContentBlock,
  LlmMessage,
  LlmProvider,
  ToolChoice,
} from "../../application/ports/llm-provider.js";

/** The part of the SDK this adapter needs. Kept narrow so tests can stub it. */
export interface MessagesClient {
  create(
    params: Anthropic.MessageCreateParamsNonStreaming,
    options?: { signal?: AbortSignal | undefined },
  ): Promise<Anthropic.Message>;
}

// One retry with a 20s timeout keeps a single call under ~40s worst case.
export function createAnthropicClient(apiKey: string): MessagesClient {
  return new Anthropic({ apiKey, maxRetries: 1, timeout: 20_000 }).messages;
}

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";

  constructor(
    private readonly messages: MessagesClient,
    readonly model: string,
  ) {}

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const response = await this.messages.create(
        {
          model: this.model,
          max_tokens: request.maxTokens,
          system: request.system,
          messages: request.messages.map(toAnthropicMessage),
          ...(request.tools && {
            tools: request.tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: { type: "object" as const, ...t.inputSchema },
            })),
          }),
          ...(request.toolChoice && { tool_choice: toToolChoice(request.toolChoice, request.singleToolCall) }),
        },
        { signal: request.context?.signal },
      );

      return {
        content: response.content.flatMap(fromAnthropicBlock),
        stopReason: mapStopReason(response.stop_reason),
        usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
        model: response.model,
      };
    } catch (error) {
      throw isTransient(error, request.context?.signal) ? new LlmUnavailableError(error) : error;
    }
  }
}

function toToolChoice(toolChoice: ToolChoice, singleToolCall = false): Anthropic.ToolChoice {
  return singleToolCall ? { ...toolChoice, disable_parallel_tool_use: true } : toolChoice;
}

/**
 * Rate limits, overload, timeouts and network failures are transient.
 * Other 4xx responses mean a bug or bad configuration on our side and surface
 * as internal errors. An abort caused by the request deadline counts as a timeout;
 * one caused by the client leaving is passed through.
 */
function isTransient(error: unknown, signal: AbortSignal | undefined): boolean {
  if (error instanceof Anthropic.APIUserAbortError) {
    return signal?.reason instanceof DOMException && signal.reason.name === "TimeoutError";
  }
  if (error instanceof Anthropic.APIConnectionError) return true;
  if (error instanceof Anthropic.APIError) {
    const status = (error as { status?: number }).status;
    return status === undefined || status === 408 || status === 409 || status === 429 || status >= 500;
  }
  return false;
}

function toAnthropicMessage(message: LlmMessage): Anthropic.MessageParam {
  return {
    role: message.role,
    content: message.content.map((block): Anthropic.ContentBlockParam => {
      switch (block.type) {
        case "text":
          return { type: "text", text: block.text };
        case "tool_use":
          return { type: "tool_use", id: block.id, name: block.name, input: block.input };
        case "tool_result":
          return {
            type: "tool_result",
            tool_use_id: block.toolUseId,
            content: block.content,
            ...(block.isError !== undefined && { is_error: block.isError }),
          };
      }
    }),
  };
}

function fromAnthropicBlock(block: Anthropic.ContentBlock): ContentBlock[] {
  if (block.type === "text") return [{ type: "text", text: block.text }];
  if (block.type === "tool_use") return [{ type: "tool_use", id: block.id, name: block.name, input: block.input }];
  return []; // thinking and server-tool blocks are not used here
}

function mapStopReason(reason: Anthropic.Message["stop_reason"]): CompletionResponse["stopReason"] {
  switch (reason) {
    case "end_turn":
    case "tool_use":
    case "max_tokens":
      return reason;
    default:
      return "other";
  }
}
