import type { Symptom } from "../../../domain/model.js";

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

/** Matches "sep" or "september", but not "maybe" or "marching". */
export const MONTH_PATTERN = MONTHS.map((m) => `${m.slice(0, 3)}(?:${m.slice(3)})?`).join("|");

export const monthIndex = (word: string): number => MONTHS.findIndex((m) => m.startsWith(word));

export const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export const SYMPTOM_PATTERNS: readonly (readonly [RegExp, Symptom])[] = [
  [/\bmigraines?\b/, "migraine"],
  [/\b(?:headaches?|head was pounding|head hurt)\b/, "headache"],
  [/\bfatigued?\b/, "fatigue"],
  [/\bnause(?:a|ous)\b/, "nausea"],
  [/\bdizz(?:y|iness)\b/, "dizziness"],
  [/\bcough(?:ing)?\b/, "cough"],
  [/\bsore throat\b/, "sore_throat"],
  [/\b(?:fever|temperature of)\b/, "fever"],
  [/\b(?:congest(?:ed|ion)|stuffy nose|blocked nose)\b/, "congestion"],
  [/\b(?:back (?:pain|ache|hurt)|lower back)\b/, "back_pain"],
  [/\b(?:joint pain|knees? (?:hurt|ache))\b/, "joint_pain"],
  [/\b(?:muscle (?:ache|pain|soreness)|sore muscles)\b/, "muscle_ache"],
  [/\b(?:stomach ?ache|stomach (?:hurt|pain)|belly ache)\b/, "stomach_ache"],
  [/\banxi(?:ety|ous)\b/, "anxiety"],
  [/\binsomnia\b/, "insomnia"],
];

export function findSymptom(lower: string): Symptom | undefined {
  return SYMPTOM_PATTERNS.find(([pattern]) => pattern.test(lower))?.[1];
}
