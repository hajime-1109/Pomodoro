DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE stats (
  id INTEGER PRIMARY KEY,
  completed_count INTEGER NOT NULL DEFAULT 0
);
