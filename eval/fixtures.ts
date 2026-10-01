import type { Extraction } from "../src/domain/model.js";

/** Reference date used for every case, so relative dates resolve deterministically. A Monday. */
export const EVAL_REFERENCE_DATE = "2026-09-28";

export interface EvalCase {
  id: string;
  text: string;
  /** Gold labels written by hand: what a careful human would extract. */
  expected: Extraction;
}

export const EVAL_CASES: EvalCase[] = [
  {
    id: "01-basic",
    text: "Slept 7 hours, energy 4, mood good. Slight headache in the afternoon.",
    expected: { sleepHours: 7, energy: 4, mood: "good", symptoms: ["headache"] },
  },
  {
    id: "02-yesterday",
    text: "Yesterday was rough. Only got 5 hours of sleep and felt exhausted all day.",
    expected: { date: "2026-09-27", sleepHours: 5, energy: 1, mood: "low", symptoms: ["fatigue"] },
  },
  {
    id: "03-scale-10",
    text: "Energy 8/10 today, slept 8 hours, feeling great.",
    expected: { date: "2026-09-28", sleepHours: 8, energy: 4, mood: "great", symptoms: [] },
  },
  {
    id: "04-negation",
    text: "No headache today for once! Slept seven hours and I'm in a good mood.",
    expected: { date: "2026-09-28", sleepHours: 7, mood: "good", symptoms: [] },
  },
  {
    id: "05-cold",
    text: "Sore throat, stuffy nose and coughing since morning. Slept badly, maybe 4 hours.",
    expected: { sleepHours: 4, mood: "low", symptoms: ["sore_throat", "congestion", "cough"] },
  },
  {
    id: "06-explicit-date",
    text: "Sep 21: migraine again, had to lie down. Felt nauseous too. Slept 6 hrs.",
    expected: { date: "2026-09-21", sleepHours: 6, mood: "low", symptoms: ["migraine", "nausea"] },
  },
  {
    id: "07-weekday",
    text: "On Friday I had lower back pain after the gym, but energy was high and I felt happy.",
    expected: { date: "2026-09-25", energy: 5, mood: "good", symptoms: ["back_pain"] },
  },
  {
    id: "08-half-hours",
    text: "Slept six and a half hours. Energy level 3. Mood okay.",
    expected: { sleepHours: 6.5, energy: 3, mood: "okay", symptoms: [] },
  },
  {
    id: "09-colloquial",
    text: "Barely slept, tossing and turning till 3am. Couldn't fall asleep at all, pretty anxious about the interview.",
    expected: { mood: "low", energy: 2, symptoms: ["insomnia", "anxiety"] },
  },
  {
    id: "10-minimal",
    text: "Fine day, nothing special.",
    expected: { mood: "okay", symptoms: [] },
  },
  {
    id: "11-not-great",
    text: "Not great. Stomach hurt after lunch and I felt dizzy on the bus.",
    expected: { mood: "low", symptoms: ["stomach_ache", "dizziness"] },
  },
  {
    id: "12-fever",
    text: "Fever of 38.5 this morning, body aches everywhere, wiped out. Slept 10 hours.",
    expected: { date: "2026-09-28", sleepHours: 10, energy: 1, mood: "bad", symptoms: ["fever", "muscle_ache"] },
  },
  {
    id: "13-range",
    text: "Slept 6-7 hours. Knees hurt on the run, otherwise good energy and a cheerful mood.",
    expected: { sleepHours: 6.5, energy: 4, mood: "good", symptoms: ["joint_pain"] },
  },
  {
    id: "14-mixed-negation",
    text: "Without any coffee I still had lots of energy. No nausea this time, just a mild headache.",
    expected: { energy: 5, symptoms: ["headache"] },
  },
  {
    id: "15-day-month",
    text: "14th of September: slept 9 hours, sluggish anyway, a bit sad. Scratchy throat.",
    expected: { date: "2026-09-14", sleepHours: 9, energy: 2, mood: "low", symptoms: ["sore_throat"] },
  },
];
