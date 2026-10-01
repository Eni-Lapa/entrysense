import { addDays, daysBetween } from "./dates.js";
import { MOODS, type Entry, type IsoDate, type Mood, type Symptom, type Trends } from "./model.js";

// Nights at or above this count toward the good-sleep streak.
const GOOD_SLEEP_HOURS = 7;
const TOP_SYMPTOMS = 5;

/** Pure: no I/O and no clock. `entries` must already be filtered to [from, to]. */
export function computeTrends(entries: readonly Entry[], from: IsoDate, to: IsoDate): Trends {
  const loggedDates = uniqueSorted(entries.map((e) => e.date));

  return {
    from,
    to,
    entryCount: entries.length,
    daysLogged: loggedDates.length,
    averages: {
      sleepHours: average(entries.map((e) => e.sleepHours)),
      energy: average(entries.map((e) => e.energy)),
    },
    moodDistribution: moodDistribution(entries),
    topSymptoms: topSymptoms(entries),
    streaks: {
      longestLoggingStreak: longestConsecutiveRun(loggedDates),
      currentLoggingStreak: currentStreakEndingAt(loggedDates, to),
      longestGoodSleepStreak: longestConsecutiveRun(goodSleepDates(entries)),
    },
  };
}

export function average(values: readonly (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  const mean = present.reduce((sum, v) => sum + v, 0) / present.length;
  return Math.round(mean * 100) / 100;
}

/** Longest run of consecutive calendar days. Input must be sorted and unique. */
export function longestConsecutiveRun(sortedDates: readonly IsoDate[]): number {
  let longest = 0;
  let run = 0;
  let previous: IsoDate | undefined;
  for (const date of sortedDates) {
    run = previous !== undefined && daysBetween(previous, date) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }
  return longest;
}

/** Consecutive logged days ending on `end`. Zero if `end` itself was not logged. */
export function currentStreakEndingAt(sortedDates: readonly IsoDate[], end: IsoDate): number {
  const logged = new Set(sortedDates);
  let streak = 0;
  for (let day = end; logged.has(day); day = addDays(day, -1)) streak++;
  return streak;
}

// A day counts only if every entry that reports sleep that day meets the threshold.
function goodSleepDates(entries: readonly Entry[]): IsoDate[] {
  const byDay = new Map<IsoDate, boolean>();
  for (const e of entries) {
    if (e.sleepHours === null) continue;
    const good = e.sleepHours >= GOOD_SLEEP_HOURS;
    byDay.set(e.date, (byDay.get(e.date) ?? true) && good);
  }
  return uniqueSorted([...byDay].filter(([, good]) => good).map(([date]) => date));
}

function moodDistribution(entries: readonly Entry[]): Record<Mood, number> {
  const dist = Object.fromEntries(MOODS.map((m) => [m, 0])) as Record<Mood, number>;
  for (const e of entries) if (e.mood !== null) dist[e.mood]++;
  return dist;
}

function topSymptoms(entries: readonly Entry[]): { symptom: Symptom; count: number }[] {
  const counts = new Map<Symptom, number>();
  for (const e of entries) for (const s of e.symptoms) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts]
    .map(([symptom, count]) => ({ symptom, count }))
    .sort((a, b) => b.count - a.count || a.symptom.localeCompare(b.symptom))
    .slice(0, TOP_SYMPTOMS);
}

const uniqueSorted = (dates: readonly IsoDate[]): IsoDate[] => [...new Set(dates)].sort();
