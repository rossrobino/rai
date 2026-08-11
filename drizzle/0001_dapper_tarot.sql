CREATE TABLE `market_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`date` text NOT NULL,
	`close` real NOT NULL,
	`provider` text NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_prices_symbol_date_unique` ON `market_prices` (`symbol`,`date`);