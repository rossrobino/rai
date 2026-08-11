import assert from "node:assert/strict";
import test from "node:test";
import { fetchQqq } from "../src/server/alpha-vantage";

test("QQQ history uses Alpha Vantage's compact daily endpoint", async () => {
	let requested: URL | undefined;
	const prices = await fetchQqq("test-key", async (input) => {
		requested = new URL(input);
		return new Response(
			JSON.stringify({
				"Meta Data": { "2. Symbol": "QQQ" },
				"Time Series (Daily)": {
					"2026-08-11": { "4. close": "612.50" },
					"2026-08-10": { "4. close": "610.25" },
				},
			}),
		);
	});

	assert.equal(requested?.origin, "https://www.alphavantage.co");
	assert.equal(requested?.searchParams.get("function"), "TIME_SERIES_DAILY");
	assert.equal(requested?.searchParams.get("symbol"), "QQQ");
	assert.equal(requested?.searchParams.get("outputsize"), "compact");
	assert.equal(requested?.searchParams.get("apikey"), "test-key");
	assert.deepEqual(
		prices.map(({ date, close }) => ({ date, close })),
		[
			{ date: "2026-08-10", close: 610.25 },
			{ date: "2026-08-11", close: 612.5 },
		],
	);
});

test("QQQ history rejects missing keys and unexpected symbols", async () => {
	await assert.rejects(() => fetchQqq(""), /not configured/);
	await assert.rejects(
		() =>
			fetchQqq(
				"test-key",
				async () =>
					new Response(
						JSON.stringify({
							"Meta Data": { "2. Symbol": "SPY" },
							"Time Series (Daily)": {
								"2026-08-11": { "4. close": "100" },
							},
						}),
					),
			),
		/invalid QQQ daily data/,
	);
});
