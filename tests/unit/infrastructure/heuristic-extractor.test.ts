import { describe, expect, it } from "vitest";
import { extractDate, heuristicExtract } from "../../../src/infrastructure/llm/mock/heuristic-extractor.js";

const REF = "2026-09-28"; // a Monday

describe("heuristicExtract", () => {
  it.each([
    ["yesterday was rough", "2026-09-27"],
    ["this morning I felt fine", REF],
    ["sep 21: migraine", "2026-09-21"],
    ["14th of september, tired", "2026-09-14"],
    ["on friday my back hurt", "2026-09-25"],
    ["last monday", "2026-09-21"],
    ["logged on 2026-08-02", "2026-08-02"],
    ["maybe 4 hours of sleep", undefined],
  ])("resolves the date in %j", (note, expected) => {
    expect(extractDate(note, REF)).toBe(expected);
  });

  it("extracts sleep, energy, mood and symptoms from a typical note", () => {
    expect(heuristicExtract("Slept seven and a half hours, energy 4, feeling happy. Sore throat.", REF)).toEqual({
      sleepHours: 7.5,
      energy: 4,
      mood: "good",
      symptoms: ["sore_throat"],
    });
  });

  it("skips a symptom negated right before it", () => {
    expect(heuristicExtract("No headache today, but a cough.", REF).symptoms).toEqual(["cough"]);
  });

  it("copies an out-of-scale energy verbatim first and rescales it on the careful pass", () => {
    const note = "energy 8/10";
    expect(heuristicExtract(note, REF).energy).toBe(8);
    expect(heuristicExtract(note, REF, { careful: true }).energy).toBe(4);
  });
});
