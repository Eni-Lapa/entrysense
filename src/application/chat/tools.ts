import { z } from "zod";
import { DateRange, IsoDate, MAX_RANGE_DAYS, Symptom, withRangeChecks } from "../../domain/model.js";
import type { EntryService } from "../entries/entry-service.js";
import type { ToolDefinition } from "../ports/llm-provider.js";
import { toToolInputSchema } from "../tool-schema.js";
import { toIssues } from "../validation.js";

export const SEARCH_ENTRIES = "search_entries";
export const GET_TRENDS = "get_trends";
export const MAX_SEARCH_RESULTS = 50;

const SearchEntriesArgs = withRangeChecks(
  z.object({ from: IsoDate, to: IsoDate, symptom: Symptom.optional() }).strict(),
  { maxDays: MAX_RANGE_DAYS },
);

export type ToolOutcome = { ok: true; result: unknown } | { ok: false; error: string };

export interface Tool {
  readonly definition: ToolDefinition;
  run(input: unknown): Promise<ToolOutcome>;
}

export type ToolRegistry = ReadonlyMap<string, Tool>;

/** Arguments are validated against the tool's schema before `execute` sees them. */
function defineTool<S extends z.ZodType>(
  name: string,
  description: string,
  args: S,
  execute: (args: z.infer<S>) => Promise<unknown>,
): Tool {
  return {
    definition: { name, description, inputSchema: toToolInputSchema(args) },
    async run(input) {
      const parsed = args.safeParse(input);
      if (!parsed.success) {
        const issues = toIssues(parsed.error).map((i) => `${i.path}: ${i.message}`);
        return { ok: false, error: `Invalid arguments: ${issues.join("; ")}` };
      }
      return { ok: true, result: await execute(parsed.data) };
    },
  };
}

export function createTools(entries: EntryService): ToolRegistry {
  const tools = [
    defineTool(
      SEARCH_ENTRIES,
      `Find journal entries between two dates (inclusive, at most ${MAX_RANGE_DAYS} days), optionally only those mentioning one symptom. Returns the ${MAX_SEARCH_RESULTS} most recent matches, newest first, and the total count.`,
      SearchEntriesArgs,
      async ({ from, to, symptom }) => {
        const { items, total } = await entries.find({ from, to, symptom, page: 1, pageSize: MAX_SEARCH_RESULTS });
        return {
          count: total,
          entries: items.map(({ date, sleepHours, energy, mood, symptoms }) => ({
            date,
            sleepHours,
            energy,
            mood,
            symptoms,
          })),
        };
      },
    ),
    defineTool(
      GET_TRENDS,
      `Compute averages (sleep hours, energy), mood distribution, top symptoms and streaks between two dates (inclusive, at most ${MAX_RANGE_DAYS} days).`,
      DateRange,
      ({ from, to }) => entries.trends(from, to),
    ),
  ];
  return new Map(tools.map((t) => [t.definition.name, t]));
}
