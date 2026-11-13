// One-time seed: write the current Pomodoro stats into the Turso
// database so a move to Vercel continues from the existing counts.
//
// Usage (values shown are an example):
//   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... \
//   SEED_COMPLETED_COUNT=21 SEED_TODAY_COUNT=3 \
//   SEED_TODAY_DATE=2026-11-13 SEED_QUOTE_INDEX=28 \
//   node scripts/seed.mjs

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL is required");
  process.exit(1);
}

function intEnv(name, required) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    if (required) {
      console.error(`${name} is required`);
      process.exit(1);
    }
    return null;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    console.error(`${name} must be a non-negative integer`);
    process.exit(1);
  }
  return value;
}

const completedCount = intEnv("SEED_COMPLETED_COUNT", true);
const todayCount = intEnv("SEED_TODAY_COUNT", false) ?? 0;
const quoteIndex = intEnv("SEED_QUOTE_INDEX", false);
const todayDate = process.env.SEED_TODAY_DATE || null;
if (todayDate && !/^\d{4}-\d{2}-\d{2}$/.test(todayDate)) {
  console.error("SEED_TODAY_DATE must be YYYY-MM-DD");
  process.exit(1);
}

const db = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

await db.execute(`
  CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY,
    completed_count INTEGER NOT NULL DEFAULT 0,
    quote_index INTEGER,
    today_count INTEGER NOT NULL DEFAULT 0,
    today_date TEXT
  )
`);

await db.execute({
  sql: `INSERT INTO stats
          (id, completed_count, today_count, today_date, quote_index)
        VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          completed_count = excluded.completed_count,
          today_count = excluded.today_count,
          today_date = excluded.today_date,
          quote_index = excluded.quote_index`,
  args: [completedCount, todayCount, todayDate, quoteIndex],
});

const result = await db.execute(
  `SELECT
     completed_count AS completedCount,
     today_count AS todayCount,
     today_date AS todayDate,
     quote_index AS quoteIndex
   FROM stats
   WHERE id = 1`,
);
console.log("Seeded stats:", result.rows[0]);
