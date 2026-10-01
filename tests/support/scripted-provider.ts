import type {
  CompletionRequest,
  CompletionResponse,
  ContentBlock,
  LlmProvider,
} from "../../src/application/ports/llm-provider.js";

/** Replays scripted responses in order (repeating the last one) and records every request. */
export class ScriptedProvider implements LlmProvider {
  readonly name = "scripted";
  readonly model = "scripted-v1";
  readonly requests: CompletionRequest[] = [];
  private index = 0;

  constructor(private readonly script: ContentBlock[][]) {}

  complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Messages are cloned because callers keep appending to the same array.
    this.requests.push({ ...request, messages: structuredClone(request.messages) });
    const content = this.script[Math.min(this.index++, this.script.length - 1)] ?? [];
    return Promise.resolve({
      content,
      stopReason: content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
      usage: { inputTokens: 10, outputTokens: 5 },
      model: this.model,
    });
  }
}

export const toolUse = (name: string, input: unknown, id = `toolu_${name}`): ContentBlock => ({
  type: "tool_use",
  id,
  name,
  input,
});

export const text = (value: string): ContentBlock => ({ type: "text", text: value });
