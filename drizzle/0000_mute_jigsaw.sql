CREATE TABLE `my_notes` (
	`problem_id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `problems` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`contest_id` text NOT NULL,
	`difficulty` integer
);
