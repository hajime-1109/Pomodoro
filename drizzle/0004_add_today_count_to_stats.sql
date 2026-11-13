ALTER TABLE stats ADD COLUMN today_count INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE stats ADD COLUMN today_date TEXT;
