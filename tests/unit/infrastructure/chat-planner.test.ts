import { describe, expect, it } from "vitest";
import { composeAnswer, planToolCalls, resolveRange } from "../../../src/infrastructure/llm/mock/chat-planner.js";

const TODAY = "2026-09-28";

describe("planToolCalls and resolveRange", () => {
  it.each([
    ["how was last week", { from: "2026-09-22", to: TODAY }],
    ["the past 3 days", { from: "2026-09-26", to: TODAY }],
    ["yesterday", { from: "2026-09-27", to: "2026-09-27" }],
    ["this month", { from: "2026-09-01", to: TODAY }],
    ["in august", { from: "2026-08-01", to: "2026-08-31" }],
    ["during december", { from: "2025-12-01", to: "2025-12-31" }],
    ["may I ask about sleep", { from: "2026-08-30", to: TODAY }],
    ["anything", { from: "2026-08-30", to: TODAY }],
  ])("resolves %j to a date range", (question, expected) => {
    expect(resolveRange(question, TODAY)).toEqual(expected);
  });

  it("searches for a symptom and asks for trends when the question needs both", () => {
    expect(planToolCalls("When did I have a migraine last week and how was my sleep?", TODAY)).toEqual([
      { name: "search_entries", input: { from: "2026-09-22", to: TODAY, symptom: "migraine" } },
      { name: "get_trends", input: { from: "2026-09-22", to: TODAY } },
    ]);
  });
});

describe("composeAnswer", () => {
  const trends = {
    from: "2026-09-22",
    to: "2026-09-28",
    entryCount: 3,
    daysLogged: 3,
    averages: { sleepHours: 6.5, energy: null },
    moodDistribution: { great: 0, good: 1, okay: 2, low: 0, bad: 0 },
    topSymptoms: [{ symptom: "sore_throat" as const, count: 2 }],
    streaks: { longestLoggingStreak: 3, currentLoggingStreak: 3, longestGoodSleepStreak: 0 },
  };

  it("summarises trends using only the numbers it was given", () => {
    expect(composeAnswer([{ name: "get_trends", payload: trends, isError: false }])).toBe(
      "Between 2026-09-22 and 2026-09-28 you logged 3 days, averaged 6.5 hours of sleep. " +
        "The most frequent symptom was sore throat (2x). Your longest logging streak was 3 days.",
    );
  });

  it("admits a failed lookup instead of inventing numbers", () => {
    expect(composeAnswer([{ name: "get_trends", payload: null, isError: true }])).toMatch(/failed/);
  });

  it("says so when there is nothing to report", () => {
    const answer = composeAnswer([
      { name: "search_entries", payload: { count: 0, entries: [] }, isError: false },
      { name: "get_trends", payload: { ...trends, entryCount: 0 }, isError: false },
    ]);
    expect(answer).toBe(
      "I found no matching entries in that period. There are no entries between 2026-09-22 and 2026-09-28.",
    );
  });
});
