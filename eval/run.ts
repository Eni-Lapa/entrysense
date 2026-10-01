/**
 * Extraction eval: runs every fixture through the real ExtractionService with the
 * provider selected in .env, reports field-level accuracy, and fails when overall
 * accuracy drops below the committed baseline for that provider.
 *
 * Scoring: a field absent from both the output and the gold label counts as
 * correct, because not inventing a value is part of the task.
 */
import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { ExtractionFailedError } from "../src/application/errors.js";
import { ExtractionService } from "../src/application/extraction/extraction-service.js";
import { createProvider } from "../src/container.js";
import type { Extraction } from "../src/domain/model.js";
import { loadEnv } from "../src/infrastructure/config/env.js";
import { EVAL_CASES, EVAL_REFERENCE_DATE } from "./fixtures.js";

const FIELDS = ["date", "sleepHours", "energy", "mood", "symptoms"] as const;
type Field = (typeof FIELDS)[number];

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
  API_KEY: process.env.API_KEY ?? "eval-only-api-key",
  STORAGE: "memory",
});
const provider = createProvider(env, { today: () => EVAL_REFERENCE_DATE });
const service = new ExtractionService(provider);

function fieldCorrect(field: Field, got: Extraction, want: Extraction): boolean {
  switch (field) {
    case "date": // a missing date is stored as the reference date, so score what would be stored
      return (got.date ?? EVAL_REFERENCE_DATE) === (want.date ?? EVAL_REFERENCE_DATE);
    case "sleepHours":
      return got.sleepHours === undefined || want.sleepHours === undefined
        ? got.sleepHours === want.sleepHours
        : Math.abs(got.sleepHours - want.sleepHours) <= 0.25;
    case "symptoms":
      return [...got.symptoms].sort().join() === [...want.symptoms].sort().join();
    default:
      return got[field] === want[field];
  }
}

const correct: Record<Field, number> = { date: 0, sleepHours: 0, energy: 0, mood: 0, symptoms: 0 };
let truePos = 0;
let falsePos = 0;
let falseNeg = 0;
let retries = 0;
let failures = 0;
const rows: string[] = [];

for (const c of EVAL_CASES) {
  try {
    const { extraction, attempts } = await service.extract(c.text, EVAL_REFERENCE_DATE);
    if (attempts === 2) retries++;
    const marks = FIELDS.map((f) => {
      const ok = fieldCorrect(f, extraction, c.expected);
      if (ok) correct[f]++;
      return ok ? "✓" : "✗";
    });
    const got = new Set(extraction.symptoms);
    const want = new Set(c.expected.symptoms);
    truePos += [...got].filter((s) => want.has(s)).length;
    falsePos += [...got].filter((s) => !want.has(s)).length;
    falseNeg += [...want].filter((s) => !got.has(s)).length;
    rows.push(`| ${c.id} | ${marks.join(" | ")} | ${attempts} |`);
  } catch (error) {
    if (!(error instanceof ExtractionFailedError)) throw error;
    failures++;
    rows.push(`| ${c.id} | ${FIELDS.map(() => "–").join(" | ")} | failed |`);
  }
}

const n = EVAL_CASES.length;
const pct = (x: number, total = n) => `${total === 0 ? 0 : Math.round((x / total) * 100)}%`;
const totalCorrect = FIELDS.reduce((sum, f) => sum + correct[f], 0);

const report = [
  `## Extraction eval`,
  ``,
  `Provider: \`${provider.name}\` · model: \`${provider.model}\` · cases: ${n} · reference date: ${EVAL_REFERENCE_DATE}`,
  ``,
  `| Field | Accuracy |`,
  `| --- | --- |`,
  ...FIELDS.map((f) => `| ${f} | ${pct(correct[f])} |`),
  `| **overall (field-level)** | **${pct(totalCorrect, n * FIELDS.length)}** |`,
  ``,
  `Symptoms precision ${pct(truePos, truePos + falsePos)} · recall ${pct(truePos, truePos + falseNeg)} · corrective retries ${retries}/${n} · hard failures (422) ${failures}/${n}`,
  ``,
  `<details><summary>Per case</summary>`,
  ``,
  `| Case | ${FIELDS.join(" | ")} | Attempts |`,
  `| --- | ${FIELDS.map(() => "---").join(" | ")} | --- |`,
  ...rows,
  ``,
  `</details>`,
  ``,
].join("\n");

console.log(report);
await writeFile(new URL(`./results-${provider.name}.md`, import.meta.url), report);

const baselines = JSON.parse(await readFile(new URL("./baseline.json", import.meta.url), "utf8")) as Record<
  string,
  number
>;
const overall = totalCorrect / (n * FIELDS.length);
const baseline = baselines[provider.name];
if (baseline !== undefined && overall < baseline) {
  console.error(`Overall accuracy ${overall.toFixed(3)} is below the ${provider.name} baseline ${baseline}.`);
  process.exitCode = 1;
}
