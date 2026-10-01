import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export type Database = NodePgDatabase<typeof schema>;

/**
 * `onError` receives errors from idle clients (for example after a database restart).
 * Without a listener, pg emits them as unhandled "error" events and the process exits.
 */
export function createDatabase(url: string, onError: (error: Error) => void): { db: Database; pool: pg.Pool } {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  pool.on("error", onError);
  return { db: drizzle(pool, { schema }), pool };
}
