import * as schema from "./schema";
import path from "path";

let dbInstance: any;

const projectRoot = process.env.PROJECT_ROOT || "C:\\Users\\GPA\\Documents\\Gestao-de-Producao-Grafica";
const dbPath = process.env.PGLITE_DIR || path.resolve(projectRoot, "data", "postgres");

if (
  process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.startsWith("postgres://") ||
    process.env.DATABASE_URL.startsWith("postgresql://"))
) {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  dbInstance = drizzle(pool, { schema });
} else {
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite(dbPath);
  dbInstance = drizzle(client, { schema });
}

export const db = dbInstance;
export * from "./schema";
