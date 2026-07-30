export type OutcomeKind = "range" | "no_ipo";

export interface AssumptionProvenance {
	asOf: string;
	basis: "analyst-scenario" | "current-public-mark" | "deadline-forecast";
	sourceUrl: string;
	rationale: string;
}

export interface Assumptions {
	discountRate: number;
	expectedDate: string;
	lowerValue: number;
	upperValue: number;
	noIpoCurrentValue: number;
	provenance: AssumptionProvenance;
	uncertainty: {
		discountRateLow: number;
		discountRateHigh: number;
		noIpoValueLow: number;
		noIpoValueHigh: number;
	};
}

export interface Outcome {
	key: string;
	label: string;
	kind: OutcomeKind;
	lower: number | null;
	upper: number | null;
	representativeValue: number | null;
	rawProbability: number;
	sourceEvent: string;
	sourceMarket: string;
	sourceQuestion: string;
	selectedMethod: string;
	bid: number | null;
	ask: number | null;
	lastTrade: number | null;
	volume: number | null;
	liquidity: number | null;
	sourceUrl: string;
	sourceUpdatedAt: string | null;
	fetchedAt: string;
	sortOrder: number;
}

export interface ThresholdAssumptions {
	growthRate: number;
	expectedDate: string;
	floorValue: number;
	upperValue: number;
	provenance: AssumptionProvenance;
	uncertainty: {
		growthRateLow: number;
		growthRateHigh: number;
		floorValueLow: number;
		floorValueHigh: number;
		upperValueLow: number;
		upperValueHigh: number;
	};
}

export interface ThresholdObservation {
	key: string;
	label: string;
	value: number;
	provider: "polymarket";
	rawProbability: number;
	sourceEvent: string;
	sourceMarket: string;
	sourceQuestion: string;
	selectedMethod: string;
	bid: number | null;
	ask: number | null;
	lastTrade: number | null;
	volume: number | null;
	liquidity: number | null;
	participants: number | null;
	sourceUrl: string;
	sourceUpdatedAt: string | null;
	fetchedAt: string;
	sortOrder: number;
}

export interface ValuationInput {
	family: string;
	familyWeight: number;
	value: number;
	weight: number;
}

/**
 * Combines current-equivalent estimates without allowing a family with more
 * methods to gain weight merely because it has more inputs.
 */
export function combineValuations(inputs: ValuationInput[]) {
	if (
		inputs.some(
			(input) =>
				!Number.isFinite(input.value) ||
				input.value < 0 ||
				!Number.isFinite(input.weight) ||
				input.weight < 0 ||
				!Number.isFinite(input.familyWeight) ||
				input.familyWeight < 0,
		)
	) {
		throw new Error("Expected finite, non-negative valuation inputs.");
	}

	const groups = new Map<
		string,
		{ familyWeight: number; inputs: ValuationInput[] }
	>();
	for (const input of inputs) {
		const group = groups.get(input.family);
		if (group && group.familyWeight !== input.familyWeight) {
			throw new Error("Expected one consistent weight per evidence family.");
		}
		if (group) {
			group.inputs.push(input);
		} else {
			groups.set(input.family, {
				familyWeight: input.familyWeight,
				inputs: [input],
			});
		}
	}

	const families = [...groups.entries()].flatMap(([family, group]) => {
		const active = group.inputs.filter((input) => input.weight > 0);
		const weight = active.reduce((sum, input) => sum + input.weight, 0);
		if (group.familyWeight === 0 || weight === 0) return [];
		return [
			{
				family,
				weight: group.familyWeight,
				value:
					active.reduce((sum, input) => sum + input.value * input.weight, 0) /
					weight,
			},
		];
	});
	const weight = families.reduce((sum, family) => sum + family.weight, 0);
	if (weight === 0) {
		throw new Error(
			"Expected at least one positively weighted valuation input.",
		);
	}

	const active = inputs.filter(
		(input) => input.weight > 0 && input.familyWeight > 0,
	);
	const value =
		families.reduce((sum, family) => sum + family.value * family.weight, 0) /
		weight;
	const low = Math.min(...active.map((input) => input.value));
	const high = Math.max(...active.map((input) => input.value));

	return {
		value,
		low,
		high,
		spread: high - low,
		spreadRatio: value === 0 ? 0 : (high - low) / value,
		methods: active.length,
		families,
	};
}

/** Converts an IPO outcome ladder into a current-equivalent capitalization scenario. */
export function calculate(
	outcomes: Outcome[],
	assumptions: Assumptions,
	calculatedAt = new Date(),
) {
	if (
		!Number.isFinite(assumptions.discountRate) ||
		assumptions.discountRate < 0
	) {
		throw new Error("The discount rate must be nonnegative.");
	}

	const expected = new Date(`${assumptions.expectedDate}T12:00:00Z`);
	if (!Number.isFinite(expected.getTime()) || expected <= calculatedAt) {
		throw new Error("The expected valuation date must be in the future.");
	}

	for (const outcome of outcomes) {
		if (
			!Number.isFinite(outcome.rawProbability) ||
			outcome.rawProbability < 0 ||
			outcome.rawProbability > 1
		) {
			throw new Error(`Invalid probability for ${outcome.label}.`);
		}
		if (
			outcome.kind === "range" &&
			(outcome.representativeValue == null ||
				!Number.isFinite(outcome.representativeValue) ||
				outcome.representativeValue < 0)
		) {
			throw new Error(`Missing representative value for ${outcome.label}.`);
		}
	}

	const rawProbabilitySum = outcomes.reduce(
		(sum, outcome) => sum + outcome.rawProbability,
		0,
	);
	if (rawProbabilitySum <= 0) {
		throw new Error("Outcome probabilities must have a positive total.");
	}

	const ipoProbability = outcomes
		.filter((outcome) => outcome.kind === "range")
		.reduce(
			(sum, outcome) => sum + outcome.rawProbability / rawProbabilitySum,
			0,
		);
	const normalized = outcomes.map((outcome) => {
		const normalizedProbability = outcome.rawProbability / rawProbabilitySum;
		const conditionalProbability =
			outcome.kind === "range" && ipoProbability > 0
				? normalizedProbability / ipoProbability
				: 0;
		const contribution =
			outcome.kind === "range" && outcome.representativeValue != null
				? conditionalProbability * outcome.representativeValue
				: 0;

		return {
			...outcome,
			normalizedProbability,
			conditionalProbability,
			contribution,
		};
	});
	const conditionalIpoValue = normalized.reduce(
		(sum, outcome) => sum + outcome.contribution,
		0,
	);
	const years =
		(expected.getTime() - calculatedAt.getTime()) /
		(365.2425 * 24 * 60 * 60 * 1000);
	const factor = Math.pow(1 + assumptions.discountRate, years);
	const discountedIpoValue = conditionalIpoValue / factor;
	const presentImpliedValue =
		ipoProbability * discountedIpoValue +
		(1 - ipoProbability) * assumptions.noIpoCurrentValue;
	const warnings: string[] = [];

	if (rawProbabilitySum < 0.95 || rawProbabilitySum > 1.05) {
		warnings.push(
			`Raw probabilities total ${formatProbability(rawProbabilitySum)}; normalization changes the ladder materially.`,
		);
	}
	if (
		outcomes.some(
			(outcome) =>
				outcome.bid != null &&
				outcome.ask != null &&
				outcome.ask - outcome.bid > 0.1,
		)
	) {
		warnings.push(
			"At least one market has a bid–ask spread above 10 percentage points.",
		);
	}
	if (
		outcomes.some(
			(outcome) =>
				outcome.sourceUpdatedAt != null &&
				calculatedAt.getTime() - new Date(outcome.sourceUpdatedAt).getTime() >
					24 * 60 * 60 * 1000,
		)
	) {
		warnings.push(
			"At least one provider record was last updated more than 24 hours ago.",
		);
	}

	return {
		rawProbabilitySum,
		outcomes: normalized,
		ipoProbability,
		conditionalIpoValue,
		discountedIpoValue,
		noIpoCurrentValue: assumptions.noIpoCurrentValue,
		presentImpliedValue,
		years,
		warnings,
	};
}

function monotone(values: number[]) {
	const blocks: { start: number; end: number; sum: number; count: number }[] =
		[];

	for (let i = 0; i < values.length; i += 1) {
		blocks.push({
			start: i,
			end: i,
			sum: values[i] ?? 0,
			count: 1,
		});
		while (blocks.length > 1) {
			const current = blocks.at(-1);
			const previous = blocks.at(-2);
			if (
				!current ||
				!previous ||
				previous.sum / previous.count >= current.sum / current.count
			) {
				break;
			}
			blocks.splice(-2, 2, {
				start: previous.start,
				end: current.end,
				sum: previous.sum + current.sum,
				count: previous.count + current.count,
			});
		}
	}

	const adjusted = Array<number>(values.length);
	for (const block of blocks) {
		for (let i = block.start; i <= block.end; i += 1) {
			adjusted[i] = block.sum / block.count;
		}
	}
	return adjusted;
}

/** Converts cumulative thresholds into a maximum-by-deadline distribution. */
export function calculateThresholds(
	thresholds: ThresholdObservation[],
	assumptions: ThresholdAssumptions,
	calculatedAt = new Date(),
) {
	if (!Number.isFinite(assumptions.growthRate) || assumptions.growthRate < 0) {
		throw new Error("The deadline-peak scenario rate must be nonnegative.");
	}

	const expected = new Date(`${assumptions.expectedDate}T12:00:00Z`);
	if (!Number.isFinite(expected.getTime()) || expected <= calculatedAt) {
		throw new Error("The expected valuation date must be in the future.");
	}

	const ordered = [...thresholds].sort((a, b) => a.value - b.value);
	if (
		ordered.length < 2 ||
		assumptions.floorValue >= (ordered[0]?.value ?? 0) ||
		assumptions.upperValue < (ordered.at(-1)?.value ?? 0)
	) {
		throw new Error("Thresholds and open-tail assumptions are inconsistent.");
	}
	for (let i = 0; i < ordered.length; i += 1) {
		const threshold = ordered[i];
		if (
			!threshold ||
			!Number.isFinite(threshold.rawProbability) ||
			threshold.rawProbability < 0 ||
			threshold.rawProbability > 1 ||
			(i > 0 && threshold.value <= (ordered[i - 1]?.value ?? 0))
		) {
			throw new Error("Valuation thresholds must be unique and valid.");
		}
	}

	const adjusted = monotone(
		ordered.map((threshold) => threshold.rawProbability),
	);
	const fitted = ordered.map((threshold, i) => ({
		...threshold,
		adjustedProbability: adjusted[i] ?? 0,
	}));
	const bands = Array.from({ length: fitted.length + 1 }, (_, i) => {
		const lower =
			i === 0
				? assumptions.floorValue
				: (fitted[i - 1]?.value ?? assumptions.floorValue);
		const upper = fitted[i]?.value ?? null;
		const probability =
			i === 0
				? 1 - (fitted[0]?.adjustedProbability ?? 0)
				: i === fitted.length
					? (fitted.at(-1)?.adjustedProbability ?? 0)
					: (fitted[i - 1]?.adjustedProbability ?? 0) -
						(fitted[i]?.adjustedProbability ?? 0);
		const representativeValue =
			upper == null ? assumptions.upperValue : (lower + upper) / 2;

		return {
			key: upper == null ? `over-${lower}` : `${lower}-${upper}`,
			label:
				upper == null
					? `${formatMoney(lower)} or higher`
					: `${formatMoney(lower)}–${formatMoney(upper)}`,
			lower,
			upper,
			probability,
			representativeValue,
			contribution: probability * representativeValue,
		};
	});
	const expectedPeakValue = bands.reduce(
		(sum, band) => sum + band.contribution,
		0,
	);
	const years =
		(expected.getTime() - calculatedAt.getTime()) /
		(365.2425 * 24 * 60 * 60 * 1000);
	const deadlinePeakCurrentEquivalent =
		expectedPeakValue / Math.pow(1 + assumptions.growthRate, years);
	const warnings: string[] = [];

	if (
		fitted.some(
			(threshold) =>
				Math.abs(threshold.rawProbability - threshold.adjustedProbability) >
				0.001,
		)
	) {
		warnings.push(
			"Threshold prices were adjusted to enforce a non-increasing exceedance curve.",
		);
	}
	if (
		fitted.some(
			(threshold) =>
				threshold.bid != null &&
				threshold.ask != null &&
				threshold.ask - threshold.bid > 0.1,
		)
	) {
		warnings.push(
			"At least one market has a bid–ask spread above 10 percentage points.",
		);
	}
	if ((fitted.at(-1)?.adjustedProbability ?? 0) > 0.1) {
		warnings.push(
			"The open upper tail carries more than 10% probability, making its representative value material.",
		);
	}
	if (
		fitted.some(
			(threshold) =>
				threshold.sourceUpdatedAt != null &&
				calculatedAt.getTime() - new Date(threshold.sourceUpdatedAt).getTime() >
					24 * 60 * 60 * 1000,
		)
	) {
		warnings.push(
			"At least one provider record was last updated more than 24 hours ago.",
		);
	}

	return {
		thresholds: fitted,
		bands,
		expectedPeakValue,
		deadlinePeakCurrentEquivalent,
		years,
		warnings,
	};
}

/** Formats values stored as millions of US dollars. */
export function formatMoney(value: number, headline = false) {
	if (!Number.isFinite(value)) return "—";
	if (headline) {
		if (Math.abs(value) >= 1_000_000) {
			return `$${(value / 1_000_000).toFixed(2)}T`;
		}
		if (Math.abs(value) >= 1_000) {
			return `$${(value / 1_000).toFixed(2)}B`;
		}
		return `$${value.toFixed(2)}M`;
	}
	if (Math.abs(value) >= 1_000_000) {
		return `$${(value / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}T`;
	}
	if (Math.abs(value) >= 1_000) {
		return `$${(value / 1_000).toFixed(1).replace(/\.0$/, "")}B`;
	}
	return `$${Math.round(value)}M`;
}

export function formatProbability(value: number) {
	return `${(value * 100).toFixed(1)}%`;
}

export function formatDate(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(value));
}

export function formatDateTime(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZone: "UTC",
		timeZoneName: "short",
	}).format(new Date(value));
}
