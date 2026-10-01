import { describe, expect, it } from "vitest";
import { DateRange, Extraction } from "../../../src/domain/model.js";

describe("Extraction schema", () => {
  it("accepts a minimal extraction", () => {
    expect(Extraction.safeParse({ symptoms: [] }).success).toBe(true);
  });

  it.each([
    ["energy outside 1..5", { energy: 8, symptoms: [] }],
    ["fractional energy", { energy: 2.5, symptoms: [] }],
    ["negative sleep", { sleepHours: -1, symptoms: [] }],
    ["unknown symptom", { symptoms: ["vampirism"] }],
    ["unknown mood", { mood: "ecstatic", symptoms: [] }],
    ["non-ISO date", { date: "28/09/2026", symptoms: [] }],
    ["unexpected field", { symptoms: [], confidence: 0.9 }],
  ])("rejects %s", (_case, input) => {
    expect(Extraction.safeParse(input).success).toBe(false);
  });
});

describe("DateRange schema", () => {
  it("rejects a range that ends before it starts", () => {
    const result = DateRange.safeParse({ from: "2026-09-10", to: "2026-09-01" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["from"]);
  });
});
