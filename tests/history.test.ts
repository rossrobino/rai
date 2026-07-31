import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../src/server/db/schema";
import {
	getValuationHistory,
	recordValuations,
	type ValuationObservation,
} from "../src/server/history";

const observation: ValuationObservation = {
	companyId: "company:test",
	companySlug: "test",
	value: 150_000,
	low: 100_000,
	high: 200_000,
	methodCount: 1,
	unavailableMethodCount: 0,
	sourceFetchedAt: "2026-07-31T11:55:00.000Z",
	inputs: [
		{
			methodId: "method:test",
			method: "prediction-market-ipo",
			family: "polymarket",
			label: "Test method",
			value: 150_000,
			weight: 1,
		},
	],
};

test("daily valuation snapshots are stored once and returned chronologically", async () => {
	const folder = await mkdtemp(join(tmpdir(), "rai-history-"));
	const client = createClient({ url: `file:${join(folder, "history.db")}` });
	const db = drizzle(client, { schema });
	await migrate(db, {
		migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
	});

	try {
		const first = await recordValuations(
			[observation],
			0,
			new Date("2026-07-31T12:00:00.000Z"),
			db,
		);
		const duplicate = await recordValuations(
			[observation],
			0,
			new Date("2026-07-31T18:00:00.000Z"),
			db,
		);
		await recordValuations(
			[{ ...observation, value: 175_000 }],
			0,
			new Date("2026-08-01T12:00:00.000Z"),
			db,
		);

		assert.equal(first.inserted, true);
		assert.equal(duplicate.inserted, false);
		assert.deepEqual(
			(await getValuationHistory(observation.companyId, 365, db)).map(
				(point) => ({
					observedAt: point.observedAt,
					value: point.value,
					input: point.inputs[0]?.value,
				}),
			),
			[
				{
					observedAt: "2026-07-31T12:00:00.000Z",
					value: 150_000,
					input: 150_000,
				},
				{
					observedAt: "2026-08-01T12:00:00.000Z",
					value: 175_000,
					input: 150_000,
				},
			],
		);
	} finally {
		client.close();
		await rm(folder, { recursive: true });
	}
});
