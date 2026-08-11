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
	getPreviousValuation,
	getValuationHistory,
	peerIndex,
	realizedVolatility,
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

const peer: ValuationObservation = {
	...observation,
	companyId: "company:peer",
	companySlug: "peer",
	value: 150_000,
};

test("the peer index equal-weights returns from consecutive companies", () => {
	const result = peerIndex([
		{
			observedAt: "2026-07-31T12:00:00.000Z",
			values: [
				{ companyId: "a", value: 100 },
				{ companyId: "b", value: 200 },
			],
		},
		{
			observedAt: "2026-08-01T12:00:00.000Z",
			values: [
				{ companyId: "a", value: 110 },
				{ companyId: "b", value: 180 },
			],
		},
		{
			observedAt: "2026-08-02T12:00:00.000Z",
			values: [
				{ companyId: "a", value: 121 },
				{ companyId: "c", value: 300 },
			],
		},
	]);

	assert.equal(result[0]?.value, 100);
	assert.ok(Math.abs((result[1]?.value ?? 0) - 100) < 0.0000000001);
	assert.ok(Math.abs((result[2]?.value ?? 0) - 110) < 0.0000000001);
	assert.deepEqual(
		result.map(({ companies }) => companies),
		[2, 2, 1],
	);
});

test("realized volatility uses daily log changes and a minimum sample", () => {
	const changes = [-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03];
	const values = changes.reduce(
		(points, change) => [
			...points,
			{ value: (points.at(-1)?.value ?? 100) * Math.exp(change) },
		],
		[{ value: 100 }],
	);
	const result = realizedVolatility(values);

	assert.equal(result?.days, 7);
	assert.ok(
		Math.abs((result?.value ?? 0) - Math.sqrt((0.0028 / 6) * 365)) <
			0.0000000001,
	);
	assert.equal(realizedVolatility(values.slice(0, -1)), undefined);
});

test("daily valuation snapshots are stored once and returned chronologically", async () => {
	const folder = await mkdtemp(join(tmpdir(), "rai-history-"));
	const client = createClient({ url: `file:${join(folder, "history.db")}` });
	const db = drizzle(client, { schema });
	await migrate(db, {
		migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
	});

	try {
		const first = await recordValuations(
			[observation, peer],
			0,
			new Date("2026-07-31T12:00:00.000Z"),
			db,
		);
		const duplicate = await recordValuations(
			[observation, peer],
			0,
			new Date("2026-07-31T18:00:00.000Z"),
			db,
		);
		const easternDuplicate = await recordValuations(
			[observation, peer],
			0,
			new Date("2026-08-01T02:00:00.000Z"),
			db,
		);
		await recordValuations(
			[
				{ ...observation, value: 175_000 },
				{ ...peer, value: 165_000 },
			],
			0,
			new Date("2026-08-01T12:00:00.000Z"),
			db,
		);

		assert.equal(first.inserted, true);
		assert.equal(duplicate.inserted, false);
		assert.equal(easternDuplicate.inserted, false);
		assert.deepEqual(
			await getPreviousValuation(
				observation.companyId,
				new Date("2026-08-01T18:00:00.000Z"),
				db,
			),
			{
				observedAt: "2026-07-31T12:00:00.000Z",
				value: 150_000,
			},
		);
		assert.deepEqual(
			(await getValuationHistory(observation.companyId, 365, db)).map(
				(point) => ({
					observedAt: point.observedAt,
					value: point.value,
					benchmark:
						point.benchmark == null
							? null
							: Math.round(point.benchmark * 100) / 100,
					peers: point.peerCount,
					input: point.inputs[0]?.value,
				}),
			),
			[
				{
					observedAt: "2026-07-31T12:00:00.000Z",
					value: 150_000,
					benchmark: 100,
					peers: 1,
					input: 150_000,
				},
				{
					observedAt: "2026-08-01T12:00:00.000Z",
					value: 175_000,
					benchmark: 110,
					peers: 1,
					input: 150_000,
				},
			],
		);
	} finally {
		client.close();
		await rm(folder, { recursive: true });
	}
});
