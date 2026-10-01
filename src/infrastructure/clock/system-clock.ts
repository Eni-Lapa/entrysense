import type { Clock } from "../../application/ports/clock.js";

/** "Today" in a fixed IANA time zone, so a note written at 00:30 in Berlin is not filed under yesterday. */
export function systemClock(timeZone: string): Clock {
  // en-CA formats dates as YYYY-MM-DD.
  const format = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return { today: () => format.format(new Date()) };
}
