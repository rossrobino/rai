CREATE TABLE `valuation_inputs` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`method_id` text NOT NULL,
	`method` text NOT NULL,
	`family` text NOT NULL,
	`label` text NOT NULL,
	`value` real NOT NULL,
	`weight` real NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `valuation_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `valuation_inputs_snapshot_method_unique` ON `valuation_inputs` (`snapshot_id`,`method_id`);--> statement-breakpoint
CREATE INDEX `valuation_inputs_snapshot_idx` ON `valuation_inputs` (`snapshot_id`);--> statement-breakpoint
CREATE TABLE `valuation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`bucket` text NOT NULL,
	`observed_at` integer NOT NULL,
	`completed_at` integer NOT NULL,
	`company_count` integer NOT NULL,
	`failure_count` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `valuation_runs_bucket_unique` ON `valuation_runs` (`bucket`);--> statement-breakpoint
CREATE TABLE `valuation_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`company_id` text NOT NULL,
	`company_slug` text NOT NULL,
	`value` real NOT NULL,
	`low` real NOT NULL,
	`high` real NOT NULL,
	`method_count` integer NOT NULL,
	`unavailable_method_count` integer NOT NULL,
	`source_fetched_at` integer,
	FOREIGN KEY (`run_id`) REFERENCES `valuation_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `valuation_snapshots_run_company_unique` ON `valuation_snapshots` (`run_id`,`company_id`);--> statement-breakpoint
CREATE INDEX `valuation_snapshots_company_idx` ON `valuation_snapshots` (`company_id`);