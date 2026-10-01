import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/infrastructure/persistence/client.js";
import { PostgresEntryRepository } from "../../src/infrastructure/persistence/postgres-entry-repository.js";
import { entries } from "../../src/infrastructure/persistence/schema.js";
import { aNewEntry } from "../support/builders.js";

const url = process.env.TEST_DATABASE_URL;

// Runs in CI against a Postgres service container; skipped unless TEST_DATABASE_URL is set.
describe.skipIf(url === undefined)("PostgresEntryRepository", () => {
  const { db, pool } = createDatabase(url ?? "", (error) => {
    throw error;
  });
  const repo = new PostgresEntryRepository(db, pool);

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
    await db.delete(entries);
  });

  afterAll(async () => {
    await repo.close();
  });

  it("round-trips entries and filters by date range and symptom", async () => {
    const created = await repo.create(aNewEntry("2026-09-01", { symptoms: ["headache"], sleepHours: 6.5 }));
    await repo.create(aNewEntry("2026-09-02", { symptoms: ["cough"], mood: null }));
    await repo.create(aNewEntry("2026-10-01", { symptoms: ["headache"] }));

    expect(created).toMatchObject({ date: "2026-09-01", sleepHours: 6.5, symptoms: ["headache"] });

    const september = await repo.list({ from: "2026-09-01", to: "2026-09-30" }, { offset: 0, limit: 10 });
    expect(september.total).toBe(2);
    expect(september.items.map((e) => e.date)).toEqual(["2026-09-02", "2026-09-01"]);

    const headaches = await repo.findAll({ symptom: "headache" });
    expect(headaches.map((e) => e.date)).toEqual(["2026-09-01", "2026-10-01"]);
  });

  it("paginates newest first with a symptom filter", async () => {
    const page = await repo.list({ symptom: "headache" }, { offset: 1, limit: 1 });
    expect(page).toMatchObject({ total: 2, items: [{ date: "2026-09-01" }] });
  });

  it("enforces value ranges at the database level too", async () => {
    await expect(repo.create(aNewEntry("2026-09-03", { energy: 9 }))).rejects.toThrow();
  });

  it("answers the readiness ping", async () => {
    await expect(repo.ping()).resolves.toBeUndefined();
  });
});
