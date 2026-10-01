import { and, arrayContains, asc, count, desc, gte, lte, sql, type SQL } from "drizzle-orm";
import type pg from "pg";
import type { EntryFilter, EntryRepository, Page } from "../../application/ports/entry-repository.js";
import { Entry, type NewEntry } from "../../domain/model.js";
import type { Database } from "./client.js";
import { entries, type EntryRow } from "./schema.js";

export class PostgresEntryRepository implements EntryRepository {
  constructor(
    private readonly db: Database,
    private readonly pool: pg.Pool,
  ) {}

  async create(entry: NewEntry): Promise<Entry> {
    const [row] = await this.db.insert(entries).values(entry).returning();
    if (row === undefined) throw new Error("Insert returned no row");
    return toEntry(row);
  }

  async list(filter: EntryFilter, page: Page): Promise<{ items: Entry[]; total: number }> {
    const where = buildWhere(filter);
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(entries)
        .where(where)
        .orderBy(desc(entries.date), desc(entries.createdAt))
        .limit(page.limit)
        .offset(page.offset),
      this.db.select({ value: count() }).from(entries).where(where),
    ]);
    return { items: rows.map(toEntry), total: totals[0]?.value ?? 0 };
  }

  async findAll(filter: EntryFilter): Promise<Entry[]> {
    const rows = await this.db
      .select()
      .from(entries)
      .where(buildWhere(filter))
      .orderBy(asc(entries.date), asc(entries.createdAt));
    return rows.map(toEntry);
  }

  async ping(): Promise<void> {
    await this.db.execute(sql`select 1`);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function buildWhere({ from, to, symptom }: EntryFilter): SQL | undefined {
  return and(
    from === undefined ? undefined : gte(entries.date, from),
    to === undefined ? undefined : lte(entries.date, to),
    symptom === undefined ? undefined : arrayContains(entries.symptoms, [symptom]),
  );
}

/** The database is a boundary too, so rows are parsed on the way out. */
function toEntry(row: EntryRow): Entry {
  return Entry.parse({ ...row, createdAt: row.createdAt.toISOString() });
}
