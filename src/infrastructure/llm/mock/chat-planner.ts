import { GET_TRENDS, SEARCH_ENTRIES } from "../../../application/chat/tools.js";
import { addDays } from "../../../domain/dates.js";
import type { IsoDate, Symptom, Trends } from "../../../domain/model.js";
import { findSymptom, MONTH_PATTERN, monthIndex } from "./lexicon.js";

// Keyword-based tool planning for the mock provider. On the first turn it picks
// tools and arguments from the question; on the second it turns tool results into
// a short answer.

interface PlannedCall {
  name: typeof SEARCH_ENTRIES | typeof GET_TRENDS;
  input: Record<string, unknown>;
}

export function planToolCalls(question: string, today: IsoDate): PlannedCall[] {
  const lower = question.toLowerCase();
  const { from, to } = resolveRange(lower, today);
  const symptom = findSymptom(lower);

  const wantsTrends = /\b(average|avg|trend|streak|overall|how (much|well)|sleep|energy|mood)\b/.test(lower);
  const wantsSearch = symptom !== undefined || /\b(when|which days|list|show|entries|did i)\b/.test(lower);

  const calls: PlannedCall[] = [];
  if (wantsSearch) calls.push({ name: SEARCH_ENTRIES, input: { from, to, ...(symptom && { symptom }) } });
  if (wantsTrends || calls.length === 0) calls.push({ name: GET_TRENDS, input: { from, to } });
  return calls;
}

export function resolveRange(lower: string, today: IsoDate): { from: IsoDate; to: IsoDate } {
  const lastN = /\b(?:last|past) (\d+) days\b/.exec(lower)?.[1];
  if (lastN !== undefined) return { from: addDays(today, -(Number(lastN) - 1)), to: today };
  if (/\b(last|past|this) week\b/.test(lower)) return { from: addDays(today, -6), to: today };
  if (/\byesterday\b/.test(lower)) return { from: addDays(today, -1), to: addDays(today, -1) };
  if (/\bthis month\b/.test(lower)) return { from: `${today.slice(0, 7)}-01`, to: today };

  const monthWord = new RegExp(`\\b(?:in|during) (${MONTH_PATTERN})\\b`).exec(lower)?.[1];
  if (monthWord !== undefined) return monthRange(monthIndex(monthWord), today);
  return { from: addDays(today, -29), to: today };
}

/** The most recent occurrence of the month, clipped to today. */
function monthRange(month: number, today: IsoDate): { from: IsoDate; to: IsoDate } {
  const currentYear = Number(today.slice(0, 4));
  const year = month + 1 > Number(today.slice(5, 7)) ? currentYear - 1 : currentYear;
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const nextMonth = month === 11 ? `${year + 1}-01-01` : `${year}-${String(month + 2).padStart(2, "0")}-01`;
  const end = addDays(nextMonth, -1);
  return { from, to: end < today ? end : today };
}

interface SearchResult {
  count: number;
  entries: { date: IsoDate; symptoms: Symptom[] }[];
}

/** Only states numbers that came back from tools. */
export function composeAnswer(results: { name: string; payload: unknown; isError: boolean }[]): string {
  const sentences: string[] = [];
  for (const r of results) {
    if (r.isError) {
      sentences.push("One of the lookups failed, so this answer may be incomplete.");
      continue;
    }
    if (r.name === SEARCH_ENTRIES) sentences.push(describeSearch(r.payload as SearchResult));
    if (r.name === GET_TRENDS) sentences.push(describeTrends(r.payload as Trends));
  }
  return sentences.join(" ");
}

function describeSearch(result: SearchResult): string {
  if (result.count === 0) return "I found no matching entries in that period.";
  const dates = result.entries.map((e) => e.date);
  const shown = dates.slice(0, 5).join(", ");
  return `I found ${result.count} matching ${result.count === 1 ? "entry" : "entries"} (${shown}${dates.length > 5 ? ", ..." : ""}).`;
}

function describeTrends(t: Trends): string {
  if (t.entryCount === 0) return `There are no entries between ${t.from} and ${t.to}.`;
  const parts = [`Between ${t.from} and ${t.to} you logged ${t.daysLogged} days`];
  if (t.averages.sleepHours !== null) parts.push(`averaged ${t.averages.sleepHours} hours of sleep`);
  if (t.averages.energy !== null) parts.push(`had an average energy of ${t.averages.energy}/5`);
  const sentence = `${parts.join(", ")}.`;
  const top = t.topSymptoms[0];
  const symptom =
    top === undefined ? "" : ` The most frequent symptom was ${top.symptom.replace("_", " ")} (${top.count}x).`;
  return `${sentence}${symptom} Your longest logging streak was ${t.streaks.longestLoggingStreak} days.`;
}
