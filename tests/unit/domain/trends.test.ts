import { describe, expect, it } from "vitest";
import { average, computeTrends, currentStreakEndingAt, longestConsecutiveRun } from "../../../src/domain/trends.js";
import { anEntry } from "../../support/builders.js";

describe("computeTrends", () => {
  it("averages ignore missing values and round to two decimals", () => {
    expect(average([7, null, 6, 8.5])).toBe(7.17);
    expect(average([null, null])).toBeNull();
  });

  it("finds the longest run of consecutive days across gaps and month boundaries", () => {
    expect(longestConsecutiveRun(["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-03", "2026-09-04"])).toBe(3);
    expect(longestConsecutiveRun([])).toBe(0);
  });

  it("counts the current streak backwards from the end date, zero if that day is missing", () => {
    const dates = ["2026-09-24", "2026-09-26", "2026-09-27", "2026-09-28"];
    expect(currentStreakEndingAt(dates, "2026-09-28")).toBe(3);
    expect(currentStreakEndingAt(dates, "2026-09-25")).toBe(0);
  });

  it("computes a full summary, counting days not entries and requiring every entry that day to sleep 7h+", () => {
    const entries = [
      anEntry("2026-09-01", { sleepHours: 8, energy: 4, mood: "good", symptoms: ["headache"] }),
      anEntry("2026-09-01", { sleepHours: 6, energy: 2, mood: "low", symptoms: ["headache", "fatigue"] }),
      anEntry("2026-09-02", { sleepHours: 7.5, energy: 3, mood: "good" }),
      anEntry("2026-09-03", { sleepHours: 7, mood: "great", symptoms: ["cough"] }),
    ];

    const trends = computeTrends(entries, "2026-09-01", "2026-09-03");

    expect(trends).toMatchObject({
      entryCount: 4,
      daysLogged: 3,
      averages: { sleepHours: 7.13, energy: 3 },
      moodDistribution: { great: 1, good: 2, okay: 0, low: 1, bad: 0 },
      streaks: { longestLoggingStreak: 3, currentLoggingStreak: 3, longestGoodSleepStreak: 2 },
    });
    expect(trends.topSymptoms[0]).toEqual({ symptom: "headache", count: 2 });
  });
});
