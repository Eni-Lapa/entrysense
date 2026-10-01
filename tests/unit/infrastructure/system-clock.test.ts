import { afterEach, describe, expect, it, vi } from "vitest";
import { systemClock } from "../../../src/infrastructure/clock/system-clock.js";

describe("systemClock", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports the calendar date in the configured time zone, not UTC", () => {
    vi.useFakeTimers({ now: new Date("2026-09-27T22:30:00Z") });

    expect(systemClock("UTC").today()).toBe("2026-09-27");
    expect(systemClock("Europe/Berlin").today()).toBe("2026-09-28");
    expect(systemClock("America/New_York").today()).toBe("2026-09-27");
  });
});
