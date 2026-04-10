import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL || "file:./data.db";
const libsql = createClient({ url });

export const db = drizzle(libsql);

