import {
	index,
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const valuationRuns = sqliteTable(
	"valuation_runs",
	{
		id: text().primaryKey(),
		bucket: text().notNull(),
		observedAt: integer("observed_at", { mode: "timestamp_ms" }).notNull(),
		completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
		companyCount: integer("company_count").notNull(),
		failureCount: integer("failure_count").notNull(),
	},
	(table) => [uniqueIndex("valuation_runs_bucket_unique").on(table.bucket)],
);

export const valuationSnapshots = sqliteTable(
	"valuation_snapshots",
	{
		id: text().primaryKey(),
		runId: text("run_id")
			.notNull()
			.references(() => valuationRuns.id, { onDelete: "cascade" }),
		companyId: text("company_id").notNull(),
		companySlug: text("company_slug").notNull(),
		value: real().notNull(),
		low: real().notNull(),
		high: real().notNull(),
		methodCount: integer("method_count").notNull(),
		unavailableMethodCount: integer("unavailable_method_count").notNull(),
		sourceFetchedAt: integer("source_fetched_at", {
			mode: "timestamp_ms",
		}),
	},
	(table) => [
		uniqueIndex("valuation_snapshots_run_company_unique").on(
			table.runId,
			table.companyId,
		),
		index("valuation_snapshots_company_idx").on(table.companyId),
	],
);

export const valuationInputs = sqliteTable(
	"valuation_inputs",
	{
		id: text().primaryKey(),
		snapshotId: text("snapshot_id")
			.notNull()
			.references(() => valuationSnapshots.id, { onDelete: "cascade" }),
		methodId: text("method_id").notNull(),
		method: text().notNull(),
		family: text().notNull(),
		label: text().notNull(),
		value: real().notNull(),
		weight: real().notNull(),
	},
	(table) => [
		uniqueIndex("valuation_inputs_snapshot_method_unique").on(
			table.snapshotId,
			table.methodId,
		),
		index("valuation_inputs_snapshot_idx").on(table.snapshotId),
	],
);

export const marketPrices = sqliteTable(
	"market_prices",
	{
		id: text().primaryKey(),
		symbol: text().notNull(),
		date: text().notNull(),
		close: real().notNull(),
		provider: text().notNull(),
		fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("market_prices_symbol_date_unique").on(
			table.symbol,
			table.date,
		),
	],
);
