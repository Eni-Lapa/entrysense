import { describe, expect, it } from "vitest";
import { ChatService, MAX_STEPS } from "../../../src/application/chat/chat-service.js";
import { createTools, GET_TRENDS } from "../../../src/application/chat/tools.js";
import { LlmInvalidResponseError, ToolLoopLimitError } from "../../../src/application/errors.js";
import type { LlmProvider } from "../../../src/application/ports/llm-provider.js";
import { TODAY } from "../../support/builders.js";
import { fixedClock } from "../../support/fixed-clock.js";
import { ScriptedProvider, text, toolUse } from "../../support/scripted-provider.js";
import { inMemoryEntries } from "../../support/services.js";

const tools = createTools(inMemoryEntries().entries);
const chatWith = (llm: ScriptedProvider, maxSteps?: number) => new ChatService(llm, tools, fixedClock(TODAY), maxSteps);

describe("ChatService", () => {
  it("returns the answer directly when the model needs no tools", async () => {
    const llm = new ScriptedProvider([[text("Hello.")]]);

    await expect(chatWith(llm).ask("hi there")).resolves.toEqual({ answer: "Hello.", toolCalls: [], steps: 1 });
    expect(llm.requests[0]?.system).toContain(`Today is ${TODAY}`);
  });

  it("returns invalid tool arguments to the model instead of executing, then continues", async () => {
    const llm = new ScriptedProvider([
      [toolUse(GET_TRENDS, { from: "last week", to: TODAY }, "toolu_bad")],
      [toolUse(GET_TRENDS, { from: "2026-09-22", to: TODAY }, "toolu_good")],
      [text("You logged nothing last week.")],
    ]);

    const result = await chatWith(llm).ask("How was last week?");

    expect(result).toEqual({
      answer: "You logged nothing last week.",
      steps: 3,
      toolCalls: [
        { name: GET_TRENDS, input: { from: "last week", to: TODAY }, ok: false },
        { name: GET_TRENDS, input: { from: "2026-09-22", to: TODAY }, ok: true },
      ],
    });
    expect(llm.requests[1]?.messages.at(-1)?.content[0]).toMatchObject({
      type: "tool_result",
      toolUseId: "toolu_bad",
      isError: true,
    });
  });

  it("reports an unknown tool as a failed call without crashing", async () => {
    const llm = new ScriptedProvider([[toolUse("drop_table", {})], [text("I can't do that.")]]);

    const result = await chatWith(llm).ask("delete everything");

    expect(result.toolCalls).toEqual([{ name: "drop_table", input: {}, ok: false }]);
    expect(llm.requests[1]?.messages.at(-1)?.content[0]).toMatchObject({ content: 'Unknown tool "drop_table"' });
  });

  it("stops after the step budget with TOOL_LOOP_LIMIT, without running tools it cannot use", async () => {
    const looping = new ScriptedProvider([[toolUse(GET_TRENDS, { from: TODAY, to: TODAY })]]);
    const chat = chatWith(looping, 3);

    await expect(chat.ask("loop forever")).rejects.toBeInstanceOf(ToolLoopLimitError);
    expect(looping.requests).toHaveLength(3);
    // Tool results were fed back after steps 1 and 2 only.
    expect(looping.requests[2]?.messages).toHaveLength(5);
  });

  it("defaults to a budget of MAX_STEPS", async () => {
    const looping = new ScriptedProvider([[toolUse(GET_TRENDS, { from: TODAY, to: TODAY })]]);
    await expect(chatWith(looping).ask("loop forever")).rejects.toBeInstanceOf(ToolLoopLimitError);
    expect(looping.requests).toHaveLength(MAX_STEPS);
  });

  it("rejects a truncated answer instead of returning partial text", async () => {
    const truncated: LlmProvider = {
      name: "t",
      model: "t",
      complete: () =>
        Promise.resolve({
          content: [text("Your sleep was")],
          stopReason: "max_tokens",
          usage: { inputTokens: 1, outputTokens: 1 },
          model: "t",
        }),
    };
    await expect(new ChatService(truncated, tools, fixedClock(TODAY)).ask("sleep?")).rejects.toBeInstanceOf(
      LlmInvalidResponseError,
    );
  });

  it("passes the call context through to the provider", async () => {
    const llm = new ScriptedProvider([[text("ok")]]);
    const signal = new AbortController().signal;

    await chatWith(llm).ask("hello there", { signal, traceId: "req-1" });

    expect(llm.requests[0]?.context).toEqual({ signal, traceId: "req-1" });
  });
});
