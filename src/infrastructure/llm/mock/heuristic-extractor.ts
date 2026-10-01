import { addDays } from "../../../domain/dates.js";
import type { IsoDate, Mood, Symptom } from "../../../domain/model.js";
import { MONTH_PATTERN, monthIndex, SYMPTOM_PATTERNS, WEEKDAYS } from "./lexicon.js";

/**
 * Rule-based extractor behind the mock provider. It is a baseline, not a
 * model: synonyms outside its lists are missed and negation handling is shallow.
 *
 * Returns an unvalidated record, like a model would. On the first pass an
 * "8/10" energy is copied verbatim and fails the 1..5 schema; the careful pass
 * used on retry rescales it.
 */
export function heuristicExtract(
  text: string,
  referenceDate: IsoDate,
  opts: { careful: boolean } = { careful: false },
): Record<string, unknown> {
  const lower = text.toLowerCase();
  const out: Record<string, unknown> = { symptoms: extractSymptoms(lower) };

  const date = extractDate(lower, referenceDate);
  if (date !== undefined) out.date = date;

  const sleep = extractSleep(lower);
  if (sleep !== undefined) out.sleepHours = sleep;

  const energy = extractEnergy(lower, opts.careful);
  if (energy !== undefined) out.energy = energy;

  const mood = extractMood(lower);
  if (mood !== undefined) out.mood = mood;

  return out;
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};
const NUMBER = `(\\d+(?:\\.\\d+)?|${Object.keys(WORD_NUMBERS).join("|")})`;
const toNumber = (raw: string): number => WORD_NUMBERS[raw] ?? Number(raw);

export function extractDate(lower: string, ref: IsoDate): IsoDate | undefined {
  const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(lower)?.[1];
  if (iso !== undefined) return iso;

  if (/\byesterday\b/.test(lower)) return addDays(ref, -1);
  if (/\btoday\b|\bthis morning\b|\btonight\b/.test(lower)) return ref;

  const monthDay = new RegExp(`\\b(${MONTH_PATTERN})\\.? (\\d{1,2})\\b`).exec(lower);
  if (monthDay?.[1] !== undefined && monthDay[2] !== undefined) {
    return isoFromParts(ref, monthIndex(monthDay[1]), Number(monthDay[2]));
  }
  const dayMonth = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)? (?:of )?(${MONTH_PATTERN})\\b`).exec(lower);
  if (dayMonth?.[1] !== undefined && dayMonth[2] !== undefined) {
    return isoFromParts(ref, monthIndex(dayMonth[2]), Number(dayMonth[1]));
  }

  const weekday = new RegExp(`\\b(?:on|last) (${WEEKDAYS.join("|")})\\b`).exec(lower)?.[1];
  if (weekday !== undefined) {
    const refDow = new Date(`${ref}T00:00:00Z`).getUTCDay();
    const back = (refDow - WEEKDAYS.findIndex((d) => d === weekday) + 7) % 7 || 7;
    return addDays(ref, -back);
  }
  return undefined;
}

function isoFromParts(ref: IsoDate, monthIndex: number, day: number): IsoDate {
  const year = ref.slice(0, 4);
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractSleep(lower: string): number | undefined {
  if (!/\b(slept|sleep|asleep|night)\b/.test(lower)) return undefined;
  const match = new RegExp(`${NUMBER}( and a half)?\\s*(?:hours?|hrs?|h)\\b`).exec(lower);
  if (match?.[1] === undefined) return undefined;
  return toNumber(match[1]) + (match[2] === undefined ? 0 : 0.5);
}

const ENERGY_WORDS: [RegExp, number][] = [
  [/\b(exhausted|drained|wiped out|no energy)\b/, 1],
  [/\b(tired|sluggish|low energy|lethargic)\b/, 2],
  [/\b(full of energy|energetic|lots of energy|high energy)\b/, 5],
  [/\bgood energy\b/, 4],
];

function extractEnergy(lower: string, careful: boolean): number | undefined {
  const scaled = /energy(?: level)?(?: was| at| of|:)? (\d+)\s*\/\s*(\d+)/.exec(lower);
  if (scaled?.[1] !== undefined && scaled[2] !== undefined) {
    const value = Number(scaled[1]);
    const max = Number(scaled[2]);
    return careful ? Math.max(1, Math.min(5, Math.round((value / max) * 5))) : value;
  }
  const plain = /energy(?: level)?(?: was| at| of|:)? (\d)\b/.exec(lower)?.[1];
  if (plain !== undefined) return Number(plain);
  for (const [pattern, value] of ENERGY_WORDS) if (pattern.test(lower)) return value;
  return undefined;
}

const MOOD_WORDS: [RegExp, Mood][] = [
  [/\b(awful|terrible|miserable|horrible)\b/, "bad"],
  [/\b(sad|down|low mood|irritable|stressed|anxious|grumpy)\b/, "low"],
  [/\b(amazing|fantastic|great|wonderful|excellent)\b/, "great"],
  [/\b(happy|good mood|cheerful|content|pleasant)\b/, "good"],
  [/\b(fine|okay|ok|meh|alright|so-so)\b/, "okay"],
];

function extractMood(lower: string): Mood | undefined {
  for (const [pattern, mood] of MOOD_WORDS) if (pattern.test(lower)) return mood;
  return undefined;
}

function extractSymptoms(lower: string): Symptom[] {
  const found: Symptom[] = [];
  for (const [pattern, symptom] of SYMPTOM_PATTERNS) {
    const match = pattern.exec(lower);
    if (match === null) continue;
    // Shallow negation: "no headache" and "no bad headache" are skipped, nothing wider.
    const before = lower.slice(0, match.index);
    if (/\b(?:no|not|without|zero)\s+(?:\w+\s+)?$/.test(before)) continue;
    found.push(symptom);
  }
  return found;
}
