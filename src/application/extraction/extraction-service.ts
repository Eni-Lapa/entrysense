import { Extraction, type IsoDate } from "../../domain/model.js";
import { ExtractionFailedError, LlmInvalidResponseError } from "../errors.js";
import {
  toolUsesOf,
  type CallContext,
  type ContentBlock,
  type LlmMessage,
  type LlmProvider,
  type ToolDefinition,
} from "../ports/llm-provider.js";
import { toToolInputSchema } from "../tool-schema.js";
import { describeIssues } from "../validation.js";
import { buildExtractionPrompt, buildRetryPrompt, EXTRACTION_SYSTEM_PROMPT, EXTRACTION_TOOL_NAME } from "./prompts.js";

export interface ExtractionResult {
  extraction: Extraction;
  attempts: 1 | 2;
  /** "<provider>:<model>" that produced the accepted output. */
  extractedBy: string;
}

type Attempt =
  { ok: true; data: Extraction; model: string } | { ok: false; issues: string; assistantContent: ContentBlock[] };

const EXTRACTION_TOOL: ToolDefinition = {
  name: EXTRACTION_TOOL_NAME,
  description: "Record the structured data extracted from the health note.",
  inputSchema: toToolInputSchema(Extraction),
};

/**
 * Model output goes through the same schema as any other untrusted input.
 * Validation errors are fed back once; a second failure is rejected.
 */
export class ExtractionService {
  constructor(private readonly llm: LlmProvider) {}

  async extract(text: string, referenceDate: IsoDate, context?: CallContext): Promise<ExtractionResult> {
    const messages: LlmMessage[] = [
      { role: "user", content: [{ type: "text", text: buildExtractionPrompt(text, referenceDate) }] },
    ];

    const first = await this.attempt(messages, context);
    if (first.ok) return this.result(first, 1);

    messages.push({ role: "assistant", content: first.assistantContent }, correctionMessage(first));

    const second = await this.attempt(messages, context);
    if (second.ok) return this.result(second, 2);

    throw new ExtractionFailedError({ firstAttempt: first.issues, secondAttempt: second.issues });
  }

  private async attempt(messages: LlmMessage[], context: CallContext | undefined): Promise<Attempt> {
    const response = await this.llm.complete({
      operation: "extract-entry",
      system: EXTRACTION_SYSTEM_PROMPT,
      messages,
      tools: [EXTRACTION_TOOL],
      toolChoice: { type: "tool", name: EXTRACTION_TOOL_NAME },
      singleToolCall: true,
      maxTokens: 512,
      ...(context && { context }),
    });

    if (response.stopReason === "max_tokens") throw new LlmInvalidResponseError("output was truncated");

    const call = toolUsesOf(response.content).find((b) => b.name === EXTRACTION_TOOL_NAME);
    if (call === undefined) {
      return {
        ok: false,
        issues: `- The ${EXTRACTION_TOOL_NAME} tool was not called.`,
        assistantContent: response.content,
      };
    }

    const parsed = Extraction.safeParse(call.input);
    return parsed.success
      ? { ok: true, data: parsed.data, model: response.model }
      : { ok: false, issues: describeIssues(parsed.error), assistantContent: response.content };
  }

  private result(attempt: Extract<Attempt, { ok: true }>, attempts: 1 | 2): ExtractionResult {
    return { extraction: attempt.data, attempts, extractedBy: `${this.llm.name}:${attempt.model}` };
  }
}

/** Every tool_use needs a matching tool_result, so each one is answered with the issues. */
function correctionMessage(failed: Extract<Attempt, { ok: false }>): LlmMessage {
  const text = buildRetryPrompt(failed.issues);
  const uses = toolUsesOf(failed.assistantContent);
  return {
    role: "user",
    content:
      uses.length === 0
        ? [{ type: "text", text }]
        : uses.map((use) => ({ type: "tool_result", toolUseId: use.id, isError: true, content: text })),
  };
}
