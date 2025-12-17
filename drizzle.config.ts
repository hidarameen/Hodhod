import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

let dbUrl = process.env.DATABASE_URL.includes(',') 
  ? process.env.DATABASE_URL.split(',')[0]
  : process.env.DATABASE_URL;

if (!dbUrl.includes('sslmode=')) {
  dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'sslmode=require';
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
