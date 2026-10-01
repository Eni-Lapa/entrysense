import type { Entry, IsoDate, NewEntry, Symptom } from "../../domain/model.js";

export interface EntryFilter {
  from?: IsoDate | undefined;
  to?: IsoDate | undefined;
  symptom?: Symptom | undefined;
}

export interface Page {
  offset: number;
  limit: number;
}

export interface EntryRepository {
  create(entry: NewEntry): Promise<Entry>;
  /** Newest first. */
  list(filter: EntryFilter, page: Page): Promise<{ items: Entry[]; total: number }>;
  /** Oldest first, unpaginated. Callers pass a bounded range. */
  findAll(filter: EntryFilter): Promise<Entry[]>;
  /** Throws if the store is unreachable. Used by the readiness probe. */
  ping(): Promise<void>;
  close(): Promise<void>;
}
