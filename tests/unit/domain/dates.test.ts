import { describe, expect, it } from "vitest";
import { addDays, daysBetween } from "../../../src/domain/dates.js";

describe("dates", () => {
  it.each([
    ["2026-09-28", -1, "2026-09-27"],
    ["2026-03-01", -1, "2026-02-28"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2026-12-31", 1, "2027-01-01"],
  ])("addDays(%s, %i) = %s", (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });

  it("counts calendar days in both directions", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-10-30", "2026-10-26")).toBe(-4);
  });
});
