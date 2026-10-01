import { LlmInvalidResponseError, ToolLoopLimitError } from "../errors.js";
import type { Clock } from "../ports/clock.js";
import {
  textOf,
  toolUsesOf,
  type CallContext,
  type ContentBlock,
  type LlmMessage,
  type LlmProvider,
} from "../ports/llm-provider.js";
import { buildChatSystemPrompt } from "./prompts.js";
import type { ToolOutcome, ToolRegistry } from "./tools.js";

export const MAX_STEPS = 5;

export interface ToolCallRecord {
  name: string;
  input: unknown;
  ok: boolean;
}

export interface ChatAnswer {
  answer: string;
  toolCalls: ToolCallRecord[];
  steps: number;
}

/**
 * Bounded tool-calling loop. Each step either ends with an answer or runs the
 * requested tools and feeds the results back. The step cap bounds cost and
 * latency per request.
 */
export class ChatService {
  constructor(
    private readonly llm: LlmProvider,
    private readonly tools: ToolRegistry,
    private readonly clock: Clock,
    private readonly maxSteps = MAX_STEPS,
  ) {}

  async ask(question: string, context?: CallContext): Promise<ChatAnswer> {
    const system = buildChatSystemPrompt(this.clock.today());
    const definitions = [...this.tools.values()].map((t) => t.definition);
    const messages: LlmMessage[] = [{ role: "user", content: [{ type: "text", text: question }] }];
    const toolCalls: ToolCallRecord[] = [];

    for (let step = 1; step <= this.maxSteps; step++) {
      const response = await this.llm.complete({
        operation: "chat",
        system,
        messages,
        tools: definitions,
        toolChoice: { type: "auto" },
        maxTokens: 1024,
        ...(context && { context }),
      });

      if (response.stopReason === "max_tokens") throw new LlmInvalidResponseError("output was truncated");

      const uses = toolUsesOf(response.content);
      if (uses.length === 0) return { answer: textOf(response.content), toolCalls, steps: step };

      // No budget left to use the results, so don't run the tools.
      if (step === this.maxSteps) break;

      const results: ContentBlock[] = [];
      for (const use of uses) {
        const outcome = await this.runTool(use.name, use.input);
        toolCalls.push({ name: use.name, input: use.input, ok: outcome.ok });
        results.push(
          outcome.ok
            ? { type: "tool_result", toolUseId: use.id, content: JSON.stringify(outcome.result) }
            : { type: "tool_result", toolUseId: use.id, content: outcome.error, isError: true },
        );
      }
      messages.push({ role: "assistant", content: response.content }, { role: "user", content: results });
    }

    throw new ToolLoopLimitError(this.maxSteps);
  }

  private runTool(name: string, input: unknown): Promise<ToolOutcome> {
    const tool = this.tools.get(name);
    return tool === undefined ? Promise.resolve({ ok: false, error: `Unknown tool "${name}"` }) : tool.run(input);
  }
}
