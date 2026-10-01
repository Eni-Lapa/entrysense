// Provider-agnostic model contract. Use cases depend on this, never on an SDK.

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  /** Untrusted model output. Validate before use. */
  input: unknown;
}

export interface ToolResultBlock {
  type: "tool_result";
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface LlmMessage {
  role: "user" | "assistant";
  content: ContentBlock[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema generated from the Zod schema that validates the input. */
  inputSchema: Record<string, unknown>;
}

export type ToolChoice = { type: "auto" } | { type: "tool"; name: string };

/** Per-request context threaded from the transport down to the provider. */
export interface CallContext {
  /** Aborted when the client goes away, so in-flight model calls stop. */
  signal?: AbortSignal;
  /** Groups every model call of one request into one trace. */
  traceId?: string;
  /** Correlates model calls with the request log. */
  requestId?: string;
}

export interface CompletionRequest {
  /** Logical name used for tracing, e.g. "extract-entry". */
  operation: string;
  system: string;
  messages: LlmMessage[];
  tools?: ToolDefinition[];
  toolChoice?: ToolChoice;
  maxTokens: number;
  /** Ask for at most one tool call per response. */
  singleToolCall?: boolean;
  context?: CallContext;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CompletionResponse {
  content: ContentBlock[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "other";
  usage: TokenUsage;
  model: string;
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

export const textOf = (blocks: ContentBlock[]): string =>
  blocks
    .filter((b): b is TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

export const toolUsesOf = (blocks: ContentBlock[]): ToolUseBlock[] =>
  blocks.filter((b): b is ToolUseBlock => b.type === "tool_use");
