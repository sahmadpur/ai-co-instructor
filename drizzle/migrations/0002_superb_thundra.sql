ALTER TABLE `feedback` ADD `model` text DEFAULT 'claude-sonnet-4-6' NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `model` text DEFAULT 'claude-sonnet-4-6' NOT NULL;