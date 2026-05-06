CREATE TABLE `api_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`feedback_id` text,
	`model` text NOT NULL,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`cost_usd` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`feedback_id`) REFERENCES `feedback`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`student_id` text NOT NULL,
	`student_name` text NOT NULL,
	`student_email` text,
	`submission_id` text,
	`submission_type` text NOT NULL,
	`submission_preview` text,
	`ai_feedback` text,
	`edited_feedback` text,
	`status` text NOT NULL,
	`error_message` text,
	`generated_at` integer,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course_id` text NOT NULL,
	`course_name` text NOT NULL,
	`assignment_id` text NOT NULL,
	`assignment_title` text NOT NULL,
	`task_description` text,
	`feedback_focus` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`confirmed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`image` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);