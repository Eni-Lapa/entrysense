import { describe, expect, it } from "vitest";
import { buildChatSystemPrompt } from "../../../src/application/chat/prompts.js";
import { buildExtractionPrompt, EXTRACTION_TOOL_NAME } from "../../../src/application/extraction/prompts.js";
import { MockProvider } from "../../../src/infrastructure/llm/mock/mock-provider.js";
import { fixedClock } from "../../support/fixed-clock.js";

describe("MockProvider", () => {
  const provider = new MockProvider(fixedClock("2026-09-28"));

  it("answers a forced extraction with a tool_use block, like a real model", async () => {
    const response = await provider.complete({
      operation: "extract-entry",
      system: "",
      messages: [
        { role: "user", content: [{ type: "text", text: buildExtractionPrompt("slept 6 hours", "2026-09-28") }] },
      ],
      toolChoice: { type: "tool", name: EXTRACTION_TOOL_NAME },
      maxTokens: 100,
    });

    expect(response.stopReason).toBe("tool_use");
    expect(response.content[0]).toMatchObject({
      type: "tool_use",
      name: EXTRACTION_TOOL_NAME,
      input: { sleepHours: 6 },
    });
    expect(response.usage.inputTokens).toBeGreaterThan(0);
  });

  it("plans tool calls on the first chat turn relative to its clock", async () => {
    const response = await provider.complete({
      operation: "chat",
      system: buildChatSystemPrompt("2026-09-28"),
      messages: [{ role: "user", content: [{ type: "text", text: "average sleep yesterday?" }] }],
      maxTokens: 100,
    });

    expect(response.content).toEqual([
      expect.objectContaining({
        type: "tool_use",
        name: "get_trends",
        input: { from: "2026-09-27", to: "2026-09-27" },
      }),
    ]);
  });
});
