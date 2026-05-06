import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// libSQL accepts both `file:./local.db` (local SQLite) and `libsql://…`
// (hosted Turso) through the same client, so dev and prod share one driver.
const url = process.env.DATABASE_URL ?? "file:./local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient({
  url,
  authToken: authToken && authToken.length > 0 ? authToken : undefined,
});

export const db = drizzle(client, { schema });
export { schema };
