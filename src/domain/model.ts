import { z } from "zod";
import { daysBetween } from "./dates.js";

// Domain types are defined as Zod schemas and the TypeScript types are inferred
// from them. The same schema validates HTTP input, LLM output and database rows.

export const IsoDate = z.iso.date();
export type IsoDate = z.infer<typeof IsoDate>;

export const MOODS = ["great", "good", "okay", "low", "bad"] as const;
export const Mood = z.enum(MOODS);
export type Mood = z.infer<typeof Mood>;

// A closed vocabulary: an invented symptom fails validation instead of being stored.
export const SYMPTOMS = [
  "headache",
  "migraine",
  "fatigue",
  "nausea",
  "dizziness",
  "cough",
  "sore_throat",
  "fever",
  "congestion",
  "back_pain",
  "joint_pain",
  "muscle_ache",
  "stomach_ache",
  "anxiety",
  "insomnia",
] as const;
export const Symptom = z.enum(SYMPTOMS);
export type Symptom = z.infer<typeof Symptom>;

const SleepHours = z.number().min(0).max(24);
const Energy = z.int().min(1).max(5);

export const Extraction = z
  .object({
    date: IsoDate.optional().describe(
      "Date the note refers to, YYYY-MM-DD. Resolve relative dates against the reference date.",
    ),
    sleepHours: SleepHours.optional().describe("Hours slept, 0 to 24."),
    energy: Energy.optional().describe("Energy on a 1 to 5 scale. Convert other scales."),
    mood: Mood.optional().describe("Overall mood."),
    symptoms: z.array(Symptom).describe("Symptoms explicitly mentioned. Empty array if none."),
  })
  .strict();
export type Extraction = z.infer<typeof Extraction>;

export const Entry = z.object({
  id: z.uuid(),
  text: z.string(),
  date: IsoDate,
  sleepHours: SleepHours.nullable(),
  energy: Energy.nullable(),
  mood: Mood.nullable(),
  symptoms: z.array(Symptom),
  extractedBy: z.string(),
  createdAt: z.iso.datetime(),
});
export type Entry = z.infer<typeof Entry>;

export const NewEntry = Entry.omit({ id: true, createdAt: true });
export type NewEntry = z.infer<typeof NewEntry>;

export const Trends = z.object({
  from: IsoDate,
  to: IsoDate,
  entryCount: z.int(),
  daysLogged: z.int(),
  averages: z.object({
    sleepHours: z.number().nullable(),
    energy: z.number().nullable(),
  }),
  moodDistribution: z.record(Mood, z.int()),
  topSymptoms: z.array(z.object({ symptom: Symptom, count: z.int() })),
  streaks: z.object({
    longestLoggingStreak: z.int(),
    /** Consecutive logged days ending on `to`. */
    currentLoggingStreak: z.int(),
    longestGoodSleepStreak: z.int(),
  }),
});
export type Trends = z.infer<typeof Trends>;

/** Upper bound for unpaginated range queries (trends, chat tools). */
export const MAX_RANGE_DAYS = 366;

/** Adds the range invariants to any schema with optional `from`/`to`. */
export function withRangeChecks<S extends z.ZodType<{ from?: IsoDate | undefined; to?: IsoDate | undefined }>>(
  schema: S,
  { maxDays }: { maxDays?: number } = {},
) {
  return schema.superRefine(({ from, to }, ctx) => {
    if (from === undefined || to === undefined) return;
    if (from > to) ctx.addIssue({ code: "custom", path: ["from"], message: "`from` must be on or before `to`" });
    else if (maxDays !== undefined && daysBetween(from, to) + 1 > maxDays) {
      ctx.addIssue({ code: "custom", path: ["to"], message: `range must not exceed ${maxDays} days` });
    }
  });
}

export const DateRange = withRangeChecks(z.object({ from: IsoDate, to: IsoDate }).strict(), {
  maxDays: MAX_RANGE_DAYS,
});
export type DateRange = z.infer<typeof DateRange>;
