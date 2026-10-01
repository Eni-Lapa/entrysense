import { beforeEach, describe, expect, it } from "vitest";
import {
  createTools,
  GET_TRENDS,
  MAX_SEARCH_RESULTS,
  SEARCH_ENTRIES,
  type ToolRegistry,
} from "../../../src/application/chat/tools.js";
import type { EntryRepository } from "../../../src/application/ports/entry-repository.js";
import { addDays } from "../../../src/domain/dates.js";
import { aNewEntry } from "../../support/builders.js";
import { inMemoryEntries } from "../../support/services.js";

describe("chat tools", () => {
  let repo: EntryRepository;
  let tools: ToolRegistry;
  const run = (name: string, input: unknown) => {
    const tool = tools.get(name);
    if (tool === undefined) throw new Error(`missing tool ${name}`);
    return tool.run(input);
  };

  beforeEach(() => {
    const { repository, entries } = inMemoryEntries();
    repo = repository;
    tools = createTools(entries);
  });

  it("publishes JSON Schemas generated from the argument schemas", () => {
    expect(tools.get(SEARCH_ENTRIES)?.definition.inputSchema).toMatchObject({
      type: "object",
      required: ["from", "to"],
      additionalProperties: false,
      properties: { symptom: { enum: expect.arrayContaining(["headache"]) as unknown } },
    });
  });

  it("search_entries filters by symptom and returns the most recent matches with the full count", async () => {
    for (let i = 0; i < MAX_SEARCH_RESULTS + 5; i++) {
      await repo.create(aNewEntry(addDays("2026-01-01", i), { symptoms: ["headache"] }));
    }
    await repo.create(aNewEntry("2026-01-02", { symptoms: ["cough"] }));

    const outcome = await run(SEARCH_ENTRIES, { from: "2026-01-01", to: "2026-12-31", symptom: "headache" });

    expect(outcome.ok).toBe(true);
    const result = outcome.ok ? (outcome.result as { count: number; entries: { date: string }[] }) : undefined;
    expect(result?.count).toBe(MAX_SEARCH_RESULTS + 5);
    expect(result?.entries).toHaveLength(MAX_SEARCH_RESULTS);
    expect(result?.entries[0]?.date).toBe(addDays("2026-01-01", MAX_SEARCH_RESULTS + 4));
  });

  it.each([
    ["a missing field", { from: "2026-09-01" }],
    ["an inverted range", { from: "2026-09-10", to: "2026-09-01" }],
    ["an extra field", { from: "2026-09-01", to: "2026-09-10", limit: 5 }],
    ["a range over a year", { from: "2025-01-01", to: "2026-09-10" }],
  ])("get_trends rejects %s with a readable message", async (_case, input) => {
    const outcome = await run(GET_TRENDS, input);
    expect(outcome).toMatchObject({ ok: false, error: expect.stringMatching(/^Invalid arguments: /) as unknown });
  });
});
