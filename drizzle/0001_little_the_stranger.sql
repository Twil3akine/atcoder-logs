-- Add has_solution column if it doesn't exist
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN, so we use a workaround
-- Note: This will fail if the column already exists, but that's okay for migrations
ALTER TABLE `my_notes` ADD COLUMN `has_solution` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `my_notes` ADD COLUMN `has_explanation` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `my_notes` ADD COLUMN `updated_at` integer;--> statement-breakpoint
UPDATE `my_notes` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;