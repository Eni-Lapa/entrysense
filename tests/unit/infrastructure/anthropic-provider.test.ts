import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { LlmUnavailableError } from "../../../src/application/errors.js";
import { AnthropicProvider, type MessagesClient } from "../../../src/infrastructure/llm/anthropic-provider.js";

function stubClient(response: Partial<Anthropic.Message> | Error) {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const client: MessagesClient = {
    create(params) {
      calls.push(params);
      if (response instanceof Error) return Promise.reject(response);
      return Promise.resolve({
        model: "claude-test",
        content: [],
        stop_reason: "end_turn",
        usage: { input_tokens: 12, output_tokens: 3 },
        ...response,
      } as Anthropic.Message);
    },
  };
  return { client, calls };
}

describe("AnthropicProvider", () => {
  it("maps the provider-agnostic request to Messages API parameters", async () => {
    const { client, calls } = stubClient({});

    await new AnthropicProvider(client, "claude-test").complete({
      operation: "chat",
      system: "sys",
      maxTokens: 64,
      tools: [{ name: "get_trends", description: "d", inputSchema: { properties: {} } }],
      toolChoice: { type: "auto" },
      messages: [
        { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "get_trends", input: {} }] },
        { role: "user", content: [{ type: "tool_result", toolUseId: "t1", content: "bad", isError: true }] },
      ],
    });

    expect(calls[0]).toMatchObject({
      model: "claude-test",
      max_tokens: 64,
      system: "sys",
      tool_choice: { type: "auto" },
      tools: [{ name: "get_trends", input_schema: { type: "object", properties: {} } }],
      messages: [
        { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "get_trends", input: {} }] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "bad", is_error: true }] },
      ],
    });
  });

  it("maps the response back, dropping block types the service does not use", async () => {
    const { client } = stubClient({
      stop_reason: "tool_use",
      content: [
        { type: "thinking", thinking: "...", signature: "s" },
        { type: "text", text: "Let me check.", citations: null },
        { type: "tool_use", id: "t1", name: "get_trends", input: { from: "2026-09-01" }, caller: { type: "direct" } },
      ] as Anthropic.ContentBlock[],
    });

    const response = await new AnthropicProvider(client, "claude-test").complete({
      operation: "chat",
      system: "",
      messages: [],
      maxTokens: 10,
    });

    expect(response).toEqual({
      model: "claude-test",
      stopReason: "tool_use",
      usage: { inputTokens: 12, outputTokens: 3 },
      content: [
        { type: "text", text: "Let me check." },
        { type: "tool_use", id: "t1", name: "get_trends", input: { from: "2026-09-01" } },
      ],
    });
  });

  const fail = (error: Error) =>
    new AnthropicProvider(stubClient(error).client, "m")
      .complete({ operation: "x", system: "", messages: [], maxTokens: 1 })
      .catch((e: unknown) => e);

  it.each([
    ["overloaded (529)", Anthropic.APIError.generate(529, undefined, "overloaded", new Headers())],
    ["rate limited (429)", Anthropic.APIError.generate(429, undefined, "slow down", new Headers())],
    ["a network failure", new Anthropic.APIConnectionError({ message: "ECONNRESET" })],
  ])("wraps %s in LLM_UNAVAILABLE and keeps the cause", async (_case, cause) => {
    const error = await fail(cause);
    expect(error).toBeInstanceOf(LlmUnavailableError);
    expect((error as Error).cause).toBe(cause);
  });

  it("treats an abort caused by the request deadline as a timeout", async () => {
    const deadline = AbortSignal.abort(new DOMException("deadline", "TimeoutError"));
    const error = await new AnthropicProvider(stubClient(new Anthropic.APIUserAbortError()).client, "m")
      .complete({ operation: "x", system: "", messages: [], maxTokens: 1, context: { signal: deadline } })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmUnavailableError);
  });

  it.each([
    ["a rejected request (400)", Anthropic.APIError.generate(400, undefined, "bad schema", new Headers())],
    ["a client abort", new Anthropic.APIUserAbortError()],
  ])("passes %s through unchanged", async (_case, cause) => {
    await expect(fail(cause)).resolves.toBe(cause);
  });

  it("forwards the abort signal and asks for a single tool call when requested", async () => {
    const { client, calls } = stubClient({});
    const create = client.create.bind(client);
    let signal: AbortSignal | undefined;
    client.create = (params, options) => {
      signal = options?.signal;
      return create(params, options);
    };
    const controller = new AbortController();

    await new AnthropicProvider(client, "m").complete({
      operation: "extract-entry",
      system: "",
      messages: [],
      maxTokens: 1,
      toolChoice: { type: "tool", name: "record_entry" },
      singleToolCall: true,
      context: { signal: controller.signal },
    });

    expect(signal).toBe(controller.signal);
    expect(calls[0]?.tool_choice).toEqual({ type: "tool", name: "record_entry", disable_parallel_tool_use: true });
  });
});
