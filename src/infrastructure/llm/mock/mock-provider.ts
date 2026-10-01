import { randomUUID } from "node:crypto";
import { EXTRACTION_TOOL_NAME } from "../../../application/extraction/prompts.js";
import type { Clock } from "../../../application/ports/clock.js";
import {
  toolUsesOf,
  type CompletionRequest,
  type CompletionResponse,
  type ContentBlock,
  type LlmProvider,
  type ToolResultBlock,
} from "../../../application/ports/llm-provider.js";
import { composeAnswer, planToolCalls } from "./chat-planner.js";
import { heuristicExtract } from "./heuristic-extractor.js";
import { readExtractionPrompt } from "./prompt-reader.js";

/**
 * Deterministic offline provider. It reads the same prompts a model would and
 * answers in the same shapes (tool_use blocks, stop reasons, token usage), so
 * everything above the port runs unchanged. Enabled with LLM_PROVIDER=mock.
 */
export class MockProvider implements LlmProvider {
  readonly name = "mock";
  readonly model = "mock-heuristic-v1";

  constructor(private readonly clock: Clock) {}

  complete(request: CompletionRequest): Promise<CompletionResponse> {
    const content = isForcedExtraction(request) ? this.extract(request) : this.chat(request);
    return Promise.resolve({
      content,
      stopReason: content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
      usage: estimateUsage(request, content),
      model: this.model,
    });
  }

  private extract(request: CompletionRequest): ContentBlock[] {
    const first = request.messages[0]?.content.find((b) => b.type === "text");
    const prompt = first === undefined ? undefined : readExtractionPrompt(first.text);
    if (prompt === undefined) return [{ type: "text", text: "I could not find a note to extract." }];

    // A validation error earlier in the conversation means this is the corrective retry.
    const careful = request.messages.some((m) => m.content.some((b) => b.type === "tool_result" && b.isError === true));
    return [toolUse(EXTRACTION_TOOL_NAME, heuristicExtract(prompt.note, prompt.referenceDate, { careful }))];
  }

  private chat(request: CompletionRequest): ContentBlock[] {
    const last = request.messages.at(-1);
    const results = last?.content.filter((b): b is ToolResultBlock => b.type === "tool_result") ?? [];

    if (results.length === 0) {
      const question = last?.content.find((b) => b.type === "text")?.text ?? "";
      return planToolCalls(question, this.clock.today()).map((call) => toolUse(call.name, call.input));
    }

    const calls = toolUsesOf(request.messages.at(-2)?.content ?? []);
    const answer = composeAnswer(
      results.map((r) => ({
        name: calls.find((c) => c.id === r.toolUseId)?.name ?? "unknown",
        payload: r.isError === true ? null : (JSON.parse(r.content) as unknown),
        isError: r.isError === true,
      })),
    );
    return [{ type: "text", text: answer }];
  }
}

const isForcedExtraction = ({ toolChoice }: CompletionRequest): boolean =>
  toolChoice?.type === "tool" && toolChoice.name === EXTRACTION_TOOL_NAME;

const toolUse = (name: string, input: unknown): ContentBlock => ({
  type: "tool_use",
  id: `toolu_mock_${randomUUID()}`,
  name,
  input,
});

/** ~4 characters per token, close enough for traces. */
function estimateUsage(request: CompletionRequest, output: ContentBlock[]) {
  const inputChars =
    request.system.length + JSON.stringify(request.messages).length + JSON.stringify(request.tools ?? []).length;
  return { inputTokens: Math.ceil(inputChars / 4), outputTokens: Math.ceil(JSON.stringify(output).length / 4) };
}
