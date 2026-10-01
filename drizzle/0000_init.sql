CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"date" date NOT NULL,
	"sleep_hours" real,
	"energy" integer,
	"mood" text,
	"symptoms" text[] DEFAULT '{}' NOT NULL,
	"extracted_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entries_sleep_hours_range" CHECK ("entries"."sleep_hours" between 0 and 24),
	CONSTRAINT "entries_energy_range" CHECK ("entries"."energy" between 1 and 5),
	CONSTRAINT "entries_mood_values" CHECK ("entries"."mood" in ('great', 'good', 'okay', 'low', 'bad'))
);
--> statement-breakpoint
CREATE INDEX "entries_date_idx" ON "entries" USING btree ("date");