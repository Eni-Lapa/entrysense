import { randomUUID } from "node:crypto";
import type { EntryFilter, EntryRepository, Page } from "../../application/ports/entry-repository.js";
import type { Entry, NewEntry } from "../../domain/model.js";

export class InMemoryEntryRepository implements EntryRepository {
  private readonly entries: Entry[] = [];

  create(entry: NewEntry): Promise<Entry> {
    const stored: Entry = { ...entry, id: randomUUID(), createdAt: new Date().toISOString() };
    this.entries.push(stored);
    return Promise.resolve(stored);
  }

  list(filter: EntryFilter, page: Page): Promise<{ items: Entry[]; total: number }> {
    const matching = this.match(filter).sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
    return Promise.resolve({ items: matching.slice(page.offset, page.offset + page.limit), total: matching.length });
  }

  findAll(filter: EntryFilter): Promise<Entry[]> {
    return Promise.resolve(
      this.match(filter).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
    );
  }

  ping(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }

  private match({ from, to, symptom }: EntryFilter): Entry[] {
    return this.entries.filter(
      (e) =>
        (from === undefined || e.date >= from) &&
        (to === undefined || e.date <= to) &&
        (symptom === undefined || e.symptoms.includes(symptom)),
    );
  }
}
