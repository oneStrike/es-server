import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { drizzleConfig } from "./schema/drizzle";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle({ client: pool, ...drizzleConfig });
export type Db = typeof db;
