import { sql } from "drizzle-orm";
import { check, date, index, integer, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { MOODS } from "../../domain/model.js";

const moodList = sql.raw(MOODS.map((m) => `'${m}'`).join(", "));

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    text: text("text").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    sleepHours: real("sleep_hours"),
    energy: integer("energy"),
    mood: text("mood"),
    symptoms: text("symptoms").array().notNull().default([]),
    extractedBy: text("extracted_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("entries_date_idx").on(t.date),
    // The application validates these too; the database is the last line of defence.
    check("entries_sleep_hours_range", sql`${t.sleepHours} between 0 and 24`),
    check("entries_energy_range", sql`${t.energy} between 1 and 5`),
    check("entries_mood_values", sql`${t.mood} in (${moodList})`),
  ],
);

export type EntryRow = typeof entries.$inferSelect;
