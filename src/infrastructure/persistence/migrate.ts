import "dotenv/config";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "./client.js";

// Resolved from this file, so it works from src/ (tsx) and dist/ (node) alike.
const MIGRATIONS = fileURLToPath(new URL("../../../drizzle", import.meta.url));

const url = process.env.DATABASE_URL;
if (url === undefined || url === "") throw new Error("DATABASE_URL is not set");

const { db, pool } = createDatabase(url, (error) => {
  console.error(error);
});
try {
  await migrate(db, { migrationsFolder: MIGRATIONS });
  console.log("Migrations applied");
} finally {
  await pool.end();
}
