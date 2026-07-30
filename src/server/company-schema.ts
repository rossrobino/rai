import { Schema } from "ovr";

const IdSchema = Schema.string()
	.min(1)
	.refine(
		(value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
		"Expected a lowercase, hyphenated identifier",
	);

const FamilySchema = Schema.enum([
	"prediction-market",
	"secondary-market",
	"fundamentals",
]);

const methodShape = {
	id: IdSchema,
	weight: Schema.number().min(0),
	family: FamilySchema,
	familyWeight: Schema.number().min(0),
};

export const AssumptionProvenanceSchema = Schema.object({
	asOf: Schema.string().min(1),
	basis: Schema.enum([
		"analyst-scenario",
		"current-public-mark",
		"deadline-forecast",
	]),
	sourceUrl: Schema.string().url(),
	rationale: Schema.string().min(1),
});

export const AssumptionsSchema = Schema.object({
	discountRate: Schema.number().min(0),
	expectedDate: Schema.string().min(1),
	lowerValue: Schema.number().min(0),
	upperValue: Schema.number().min(0),
	noIpoCurrentValue: Schema.number().min(0),
	provenance: AssumptionProvenanceSchema,
	uncertainty: Schema.object({
		discountRateLow: Schema.number().min(0),
		discountRateHigh: Schema.number().min(0),
		noIpoValueLow: Schema.number().min(0),
		noIpoValueHigh: Schema.number().min(0),
	}),
}).refine(
	(value) =>
		value.uncertainty.discountRateLow <= value.discountRate &&
		value.discountRate <= value.uncertainty.discountRateHigh &&
		value.uncertainty.noIpoValueLow <= value.noIpoCurrentValue &&
		value.noIpoCurrentValue <= value.uncertainty.noIpoValueHigh,
	"Expected the IPO assumptions to fall inside their uncertainty bounds",
);

export const IpoValuationTargetSchema = Schema.object({
	measure: Schema.literal("public-market-capitalization"),
	statistic: Schema.literal("current-equivalent"),
	capitalizationBasis: Schema.literal("outstanding-shares"),
	currency: Schema.literal("USD"),
});

export const ThresholdValuationTargetSchema = Schema.object({
	measure: Schema.literal("qualifying-company-valuation"),
	statistic: Schema.literal("maximum-by-deadline"),
	capitalizationBasis: Schema.literal("provider-defined"),
	currency: Schema.literal("USD"),
});

export const MarketMappingSchema = Schema.object({
	event: IdSchema,
	sourceTitle: Schema.string().min(1),
	key: IdSchema,
	label: Schema.string().min(1),
	kind: Schema.enum(["range", "no_ipo"]),
	lower: Schema.number().min(0).nullable(),
	upper: Schema.number().min(0).nullable(),
	representativeValue: Schema.number().min(0).nullable(),
	sortOrder: Schema.number().int().min(1),
});

export const PolymarketEventSchema = Schema.object({
	id: IdSchema,
	slug: IdSchema,
	url: Schema.string().url(),
	api: Schema.string().url(),
}).refine(
	(event) =>
		event.url === `https://polymarket.com/event/${event.slug}` &&
		event.api === `https://gamma-api.polymarket.com/events/slug/${event.slug}`,
	"Expected canonical Polymarket page and Gamma API URLs",
);

export const PredictionIpoDataSchema = Schema.object({
	provider: Schema.literal("polymarket"),
	events: Schema.array(PolymarketEventSchema).refine(
		(events) => events.length > 0,
		"Expected at least one prediction-market event",
	),
	outcomes: Schema.array(MarketMappingSchema).refine(
		(outcomes) => outcomes.length > 1,
		"Expected a complete outcome ladder",
	),
});

export const PredictionIpoMethodSchema = Schema.object({
	...methodShape,
	method: Schema.literal("prediction-market-ipo"),
	target: IpoValuationTargetSchema,
	storage: Schema.literal("live"),
	upperKey: IdSchema,
	assumptions: AssumptionsSchema,
	data: PredictionIpoDataSchema,
}).refine((method) => {
	const events = new Set(method.data.events.map((event) => event.id));
	const outcomes = method.data.outcomes;
	const ranges = outcomes
		.filter((outcome) => outcome.kind === "range")
		.sort((a, b) => a.sortOrder - b.sortOrder);

	return (
		method.family === "prediction-market" &&
		new Set(method.data.events.map((event) => event.id)).size ===
			method.data.events.length &&
		new Set(method.data.events.map((event) => event.slug)).size ===
			method.data.events.length &&
		new Set(outcomes.map((outcome) => outcome.key)).size === outcomes.length &&
		new Set(outcomes.map((outcome) => outcome.sortOrder)).size ===
			outcomes.length &&
		outcomes.every((outcome) => events.has(outcome.event)) &&
		outcomes.filter((outcome) => outcome.kind === "no_ipo").length === 1 &&
		outcomes
			.filter((outcome) => outcome.kind === "no_ipo")
			.every((outcome) => outcome.representativeValue === null) &&
		ranges[0]?.lower === null &&
		ranges.at(-1)?.upper === null &&
		ranges.every(
			(outcome, i) =>
				(i === 0 || ranges[i - 1]?.upper === outcome.lower) &&
				outcome.representativeValue != null &&
				(outcome.lower == null ||
					outcome.representativeValue >= outcome.lower) &&
				(outcome.upper == null || outcome.representativeValue <= outcome.upper),
		) &&
		ranges.some((outcome) => outcome.key === method.upperKey)
	);
}, "Expected a prediction-market family, unique events, valid references, one no-IPO outcome, and a contiguous valuation ladder");

export const ThresholdAssumptionsSchema = Schema.object({
	growthRate: Schema.number().min(0),
	expectedDate: Schema.string().min(1),
	floorValue: Schema.number().min(0),
	upperValue: Schema.number().min(0),
	provenance: AssumptionProvenanceSchema,
	uncertainty: Schema.object({
		growthRateLow: Schema.number().min(0),
		growthRateHigh: Schema.number().min(0),
		floorValueLow: Schema.number().min(0),
		floorValueHigh: Schema.number().min(0),
		upperValueLow: Schema.number().min(0),
		upperValueHigh: Schema.number().min(0),
	}),
}).refine(
	(value) =>
		value.uncertainty.growthRateLow <= value.growthRate &&
		value.growthRate <= value.uncertainty.growthRateHigh &&
		value.uncertainty.floorValueLow <= value.floorValue &&
		value.floorValue <= value.uncertainty.floorValueHigh &&
		value.uncertainty.upperValueLow <= value.upperValue &&
		value.upperValue <= value.uncertainty.upperValueHigh,
	"Expected the threshold assumptions to fall inside their uncertainty bounds",
);

export const ThresholdClaimSchema = Schema.object({
	id: IdSchema,
	statistic: Schema.literal("maximum-by-deadline"),
	deadline: Schema.string().min(1),
	comparison: Schema.literal("at-least"),
	valuationSource: Schema.literal("npm-price"),
	capitalizationBasis: Schema.literal("provider-defined"),
	rulesUrl: Schema.string().url(),
	eligibleEvents: Schema.array(
		Schema.enum(["npm-price", "public-market-capitalization"]),
	).refine((events) => events.length > 0, "Expected eligible valuation events"),
});

export const ThresholdMappingSchema = Schema.object({
	event: IdSchema,
	sourceTitle: Schema.string().min(1),
	key: IdSchema,
	label: Schema.string().min(1),
	value: Schema.number().min(0),
	sortOrder: Schema.number().int().min(1),
});

export const PredictionThresholdDataSchema = Schema.object({
	provider: Schema.literal("polymarket"),
	events: Schema.array(PolymarketEventSchema).refine(
		(events) => events.length > 0,
		"Expected at least one prediction-market event",
	),
	thresholds: Schema.array(ThresholdMappingSchema).refine(
		(thresholds) => thresholds.length > 1,
		"Expected at least two valuation thresholds",
	),
	claim: ThresholdClaimSchema,
}).refine((data) => {
	const events = new Set(data.events.map((event) => event.id));
	const thresholds = [...data.thresholds].sort(
		(a, b) => a.sortOrder - b.sortOrder,
	);

	return (
		new Set(data.events.map((event) => event.id)).size === data.events.length &&
		new Set(data.events.map((event) => event.slug)).size ===
			data.events.length &&
		new Set(thresholds.map((threshold) => threshold.key)).size ===
			thresholds.length &&
		new Set(thresholds.map((threshold) => threshold.sourceTitle)).size ===
			thresholds.length &&
		new Set(thresholds.map((threshold) => threshold.value)).size ===
			thresholds.length &&
		data.events.some((event) => event.url === data.claim.rulesUrl) &&
		thresholds.every(
			(threshold, i) =>
				events.has(threshold.event) &&
				threshold.sortOrder === i + 1 &&
				(i === 0 || threshold.value > (thresholds[i - 1]?.value ?? 0)),
		)
	);
}, "Expected a canonical claim, unique events, valid references, and ordered thresholds");

export const PredictionThresholdMethodSchema = Schema.object({
	...methodShape,
	method: Schema.literal("prediction-market-valuation-thresholds"),
	target: ThresholdValuationTargetSchema,
	storage: Schema.literal("live"),
	assumptions: ThresholdAssumptionsSchema,
	data: PredictionThresholdDataSchema,
}).refine(
	(method) =>
		method.family === "prediction-market" &&
		method.data.claim.deadline === method.assumptions.expectedDate &&
		method.assumptions.floorValue < (method.data.thresholds[0]?.value ?? 0) &&
		method.assumptions.uncertainty.floorValueHigh <
			(method.data.thresholds[0]?.value ?? 0) &&
		method.assumptions.upperValue >=
			(method.data.thresholds.at(-1)?.value ?? 0) &&
		method.assumptions.uncertainty.upperValueLow >=
			(method.data.thresholds.at(-1)?.value ?? 0),
	"Expected a prediction-market family, matching claim deadline, and valid tail assumptions",
);

export const CompanyMethodSchema = Schema.union([
	PredictionIpoMethodSchema,
	PredictionThresholdMethodSchema,
]);

export const CompanySchema = Schema.object({
	id: IdSchema,
	slug: IdSchema,
	name: Schema.string().min(1),
	code: Schema.string().min(1),
	number: Schema.string().min(1),
	sector: Schema.string().min(1),
	description: Schema.string().min(1),
	methods: Schema.array(CompanyMethodSchema).refine(
		(methods) => methods.length > 0,
		"Expected at least one company method",
	),
}).refine((company) => {
	const families = new Map<string, number>();
	for (const method of company.methods) {
		if (
			families.has(method.family) &&
			families.get(method.family) !== method.familyWeight
		) {
			return false;
		}
		families.set(method.family, method.familyWeight);
	}

	return (
		new Set(company.methods.map((method) => method.id)).size ===
			company.methods.length &&
		company.methods.reduce((sum, method) => sum + method.weight, 0) > 0 &&
		[...families.values()].reduce((sum, weight) => sum + weight, 0) > 0
	);
}, "Expected unique method IDs, consistent family weights, and positive method and family totals");

export const CompanyCatalogSchema = Schema.array(CompanySchema).refine(
	(companies) =>
		companies.length > 0 &&
		new Set(companies.map((company) => company.id)).size === companies.length &&
		new Set(companies.map((company) => company.slug)).size === companies.length,
	"Expected a non-empty catalog with unique company IDs and slugs",
);

export type Company = Schema.Infer<typeof CompanySchema>;
export type CompanyMethod = Schema.Infer<typeof CompanyMethodSchema>;
export type PredictionIpoMethod = Schema.Infer<
	typeof PredictionIpoMethodSchema
>;
export type PredictionThresholdMethod = Schema.Infer<
	typeof PredictionThresholdMethodSchema
>;
