// Drizzle schema for this space: a single stats row holding how many
// work sessions the user has completed.

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const stats = sqliteTable("stats", {
  id: integer("id").primaryKey(),
  completedCount: integer("completed_count").notNull().default(0),
  // Index (0–29) into the client's QUOTES list: the quote chosen at
  // random the last time a work session was completed. Null until the
  // first completion.
  quoteIndex: integer("quote_index"),
  // Work sessions completed today (Japan time). Paired with
  // todayDate: when todayDate is not today's JST date, the effective
  // today count is 0. Yesterday's count is never kept separately.
  todayCount: integer("today_count").notNull().default(0),
  // The JST calendar date (YYYY-MM-DD) that todayCount belongs to.
  todayDate: text("today_date"),
});
