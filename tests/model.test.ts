import assert from "node:assert/strict";
import test from "node:test";
import {
	calculate,
	calculateThresholds,
	combineValuations,
	formatDateTime,
	formatMoney,
	type Assumptions,
	type Outcome,
	type ThresholdAssumptions,
	type ThresholdObservation,
} from "../src/server/model";

const provenance = {
	asOf: "2026-01-01",
	basis: "analyst-scenario" as const,
	sourceUrl: "https://example.com/research",
	rationale: "Test fixture.",
};

const defaults: Assumptions = {
	discountRate: 0.1,
	expectedDate: "2027-12-31",
	lowerValue: 75_000,
	upperValue: 2_100_000,
	noIpoCurrentValue: 965_000,
	provenance,
	uncertainty: {
		discountRateLow: 0.08,
		discountRateHigh: 0.12,
		noIpoValueLow: 800_000,
		noIpoValueHigh: 1_100_000,
	},
};

const thresholdDefaults: ThresholdAssumptions = {
	growthRate: 0.1,
	expectedDate: "2027-01-01",
	floorValue: 100,
	upperValue: 400,
	provenance,
	uncertainty: {
		growthRateLow: 0.05,
		growthRateHigh: 0.15,
		floorValueLow: 50,
		floorValueHigh: 150,
		upperValueLow: 350,
		upperValueHigh: 450,
	},
};

function outcome(
	key: string,
	kind: "range" | "no_ipo",
	rawProbability: number,
	representativeValue: number | null,
): Outcome {
	return {
		key,
		label: key,
		kind,
		lower: null,
		upper: null,
		representativeValue,
		rawProbability,
		sourceEvent: "fixture",
		sourceMarket: key,
		sourceQuestion: key,
		selectedMethod: "fixture",
		bid: null,
		ask: null,
		lastTrade: rawProbability,
		volume: null,
		liquidity: null,
		sourceUrl: "https://example.com",
		sourceUpdatedAt: "2026-01-01T00:00:00Z",
		fetchedAt: "2026-01-01T00:00:01Z",
		sortOrder: 1,
	};
}

function threshold(
	value: number,
	rawProbability: number,
): ThresholdObservation {
	return {
		key: `over-${value}`,
		label: `Over ${value}`,
		value,
		provider: "polymarket",
		rawProbability,
		sourceEvent: "fixture",
		sourceMarket: `over-${value}`,
		sourceQuestion: `Will it exceed ${value}?`,
		selectedMethod: "fixture",
		bid: null,
		ask: null,
		lastTrade: rawProbability,
		volume: null,
		liquidity: null,
		participants: 1,
		sourceUrl: "https://example.com",
		sourceUpdatedAt: "2026-01-01T00:00:00Z",
		fetchedAt: "2026-01-01T00:00:01Z",
		sortOrder: 1,
	};
}

test("normalizes an underround into a complete distribution", () => {
	const result = calculate(
		[
			outcome("low", "range", 0.2, 100_000),
			outcome("high", "range", 0.3, 300_000),
			outcome("no-ipo", "no_ipo", 0.4, null),
		],
		{ ...defaults, discountRate: 0, noIpoCurrentValue: 50_000 },
		new Date("2026-01-01T12:00:00Z"),
	);

	assert.ok(
		Math.abs(
			result.outcomes.reduce(
				(sum, value) => sum + value.normalizedProbability,
				0,
			) - 1,
		) < 1e-12,
	);
	assert.ok(Math.abs(result.ipoProbability - 5 / 9) < 1e-12);
});

test("discounts only the future IPO branch", () => {
	const result = calculate(
		[
			outcome("low", "range", 0.25, 100_000),
			outcome("high", "range", 0.25, 300_000),
			outcome("no-ipo", "no_ipo", 0.5, null),
		],
		{
			...defaults,
			discountRate: 0.1,
			expectedDate: "2027-01-01",
			noIpoCurrentValue: 50_000,
		},
		new Date("2026-01-01T12:00:00Z"),
	);

	assert.equal(result.conditionalIpoValue, 200_000);
	assert.equal(result.noIpoCurrentValue, 50_000);
	assert.ok(
		Math.abs(
			result.presentImpliedValue -
				(0.5 * result.discountedIpoValue + 0.5 * 50_000),
		) < 1e-9,
	);
});

test("rejects invalid probabilities and past dates", () => {
	assert.throws(() =>
		calculate(
			[outcome("bad", "range", -0.1, 100_000)],
			defaults,
			new Date("2026-01-01T12:00:00Z"),
		),
	);
	assert.throws(() =>
		calculate(
			[outcome("valid", "range", 1, 100_000)],
			{ ...defaults, expectedDate: "2025-01-01" },
			new Date("2026-01-01T12:00:00Z"),
		),
	);
});

test("differences cumulative thresholds into exclusive peak bands", () => {
	const result = calculateThresholds(
		[threshold(200, 0.8), threshold(300, 0.5)],
		{ ...thresholdDefaults, growthRate: 0 },
		new Date("2026-01-01T12:00:00Z"),
	);

	for (const [i, probability] of [0.2, 0.3, 0.5].entries()) {
		assert.ok(
			Math.abs((result.bands[i]?.probability ?? 0) - probability) < 1e-12,
		);
	}
	assert.equal(result.expectedPeakValue, 305);
	assert.equal(result.deadlinePeakCurrentEquivalent, 305);
});

test("uses an equal-weight fit for inverted threshold prices", () => {
	const result = calculateThresholds(
		[threshold(200, 0.4), threshold(300, 0.6)],
		thresholdDefaults,
		new Date("2026-01-01T12:00:00Z"),
	);

	assert.deepEqual(
		result.thresholds.map((value) => value.adjustedProbability),
		[0.5, 0.5],
	);
	assert.equal(result.bands[1]?.probability, 0);
	assert.ok(
		result.warnings.some((warning) =>
			warning.startsWith("Threshold prices were adjusted"),
		),
	);
});

test("formats headline values to two decimal places", () => {
	assert.equal(formatMoney(750), "$750M");
	assert.equal(formatMoney(75_000), "$75B");
	assert.equal(formatMoney(1_350_000), "$1.35T");
	assert.equal(formatMoney(1_420_000, true), "$1.42T");
	assert.equal(formatMoney(75_000, true), "$75.00B");
});

test("formats timestamps in US Eastern Time", () => {
	assert.equal(
		formatDateTime("2026-07-30T18:15:00Z"),
		"Jul 30, 2026, 2:15 PM EDT",
	);
	assert.equal(
		formatDateTime("2026-01-15T18:15:00Z"),
		"Jan 15, 2026, 1:15 PM EST",
	);
});

test("combines current-equivalent methods within evidence families", () => {
	const result = combineValuations([
		{
			family: "prediction-market",
			familyWeight: 1,
			value: 100,
			weight: 1,
		},
		{
			family: "prediction-market",
			familyWeight: 1,
			value: 200,
			weight: 3,
		},
	]);

	assert.equal(result.value, 175);
	assert.equal(result.low, 100);
	assert.equal(result.high, 200);
	assert.equal(result.methods, 2);
});

test("normalizes methods before weighting evidence families", () => {
	const result = combineValuations([
		{
			family: "prediction-market",
			familyWeight: 1,
			value: 100,
			weight: 1,
		},
		{
			family: "prediction-market",
			familyWeight: 1,
			value: 200,
			weight: 1,
		},
		{
			family: "fundamentals",
			familyWeight: 3,
			value: 250,
			weight: 1,
		},
	]);

	assert.equal(result.value, 225);
	assert.equal(result.families.length, 2);
});
