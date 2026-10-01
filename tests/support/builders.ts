import { randomUUID } from "node:crypto";
import type { Entry, IsoDate, NewEntry } from "../../src/domain/model.js";

export const TODAY: IsoDate = "2026-09-28";

export const aNewEntry = (date: IsoDate, overrides: Partial<NewEntry> = {}): NewEntry => ({
  text: `note ${date}`,
  date,
  sleepHours: 7,
  energy: 3,
  mood: "okay",
  symptoms: [],
  extractedBy: "test",
  ...overrides,
});

export const anEntry = (date: IsoDate, overrides: Partial<Entry> = {}): Entry => ({
  ...aNewEntry(date, { sleepHours: null, energy: null, mood: null }),
  id: randomUUID(),
  createdAt: `${date}T08:00:00.000Z`,
  ...overrides,
});
