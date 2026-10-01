import { describe, expect, it } from "vitest";
import { ExtractionFailedError } from "../../../src/application/errors.js";
import { ExtractionService } from "../../../src/application/extraction/extraction-service.js";
import { EXTRACTION_TOOL_NAME } from "../../../src/application/extraction/prompts.js";
import { TODAY } from "../../support/builders.js";
import { ScriptedProvider, text, toolUse } from "../../support/scripted-provider.js";

const valid = { date: TODAY, sleepHours: 7, energy: 3, mood: "okay", symptoms: ["cough"] };
const record = (input: unknown, id?: string) => toolUse(EXTRACTION_TOOL_NAME, input, id);

describe("ExtractionService", () => {
  it("accepts valid output on the first attempt and forces the extraction tool", async () => {
    const llm = new ScriptedProvider([[record(valid)]]);

    const result = await new ExtractionService(llm).extract("some note", TODAY);

    expect(result).toEqual({ extraction: valid, attempts: 1, extractedBy: "scripted:scripted-v1" });
    expect(llm.requests).toHaveLength(1);
    expect(llm.requests[0]?.toolChoice).toEqual({ type: "tool", name: EXTRACTION_TOOL_NAME });
  });

  it("feeds validation issues back as a tool_result error and accepts the corrected output", async () => {
    const llm = new ScriptedProvider([[record({ ...valid, energy: 8 }, "toolu_1")], [record(valid, "toolu_2")]]);

    const result = await new ExtractionService(llm).extract("energy 8/10", TODAY);

    expect(result.attempts).toBe(2);
    const correction = llm.requests[1]?.messages.at(-1)?.content[0];
    expect(correction).toMatchObject({ type: "tool_result", toolUseId: "toolu_1", isError: true });
    expect(correction?.type === "tool_result" ? correction.content : "").toContain("energy");
  });

  it("rejects a hallucinated symptom outside the vocabulary", async () => {
    const llm = new ScriptedProvider([[record({ ...valid, symptoms: ["cough", "vampirism"] })], [record(valid)]]);

    const result = await new ExtractionService(llm).extract("cough", TODAY);

    expect(result).toMatchObject({ attempts: 2, extraction: { symptoms: ["cough"] } });
  });

  it("answers every tool call in the correction, so the conversation stays valid", async () => {
    const llm = new ScriptedProvider([
      [record({ energy: 9, symptoms: [] }, "toolu_a"), record({ energy: 7, symptoms: [] }, "toolu_b")],
      [record(valid)],
    ]);

    await new ExtractionService(llm).extract("note", TODAY);

    expect(llm.requests[0]?.singleToolCall).toBe(true);
    expect(llm.requests[1]?.messages.at(-1)?.content).toEqual([
      expect.objectContaining({ toolUseId: "toolu_a", isError: true }),
      expect.objectContaining({ toolUseId: "toolu_b", isError: true }),
    ]);
  });

  it("asks again in plain text when the model skips the tool", async () => {
    const llm = new ScriptedProvider([[text("Sure! Here is the data.")], [record(valid)]]);

    const result = await new ExtractionService(llm).extract("note", TODAY);

    expect(result.attempts).toBe(2);
    expect(llm.requests[1]?.messages.at(-1)?.content[0]).toMatchObject({ type: "text" });
  });

  it("throws EXTRACTION_FAILED with both attempts' issues when the retry also fails", async () => {
    const llm = new ScriptedProvider([[record({ sleepHours: 30 })]]);

    const error = await new ExtractionService(llm).extract("note", TODAY).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ExtractionFailedError);
    expect(error).toMatchObject({
      code: "EXTRACTION_FAILED",
      details: { firstAttempt: expect.stringContaining("sleepHours") as unknown },
    });
    expect(llm.requests).toHaveLength(2);
  });
});
