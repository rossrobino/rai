import { Schema } from "ovr";

const RoadmapItemSchema = Schema.object({
	id: Schema.string()
		.min(1)
		.refine(
			(value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
			"Expected a lowercase, hyphenated roadmap identifier",
		),
	stage: Schema.enum(["foundation", "coverage", "instruments"]),
	status: Schema.enum(["underway", "candidate", "permission-gated", "concept"]),
	title: Schema.string().min(1),
	summary: Schema.string().min(1),
	points: Schema.array(Schema.string().min(1)).refine(
		(points) => points.length > 0,
		"Expected at least one roadmap detail",
	),
});

const RoadmapSchema = Schema.array(RoadmapItemSchema).refine(
	(items) =>
		items.length > 0 &&
		new Set(items.map((item) => item.id)).size === items.length,
	"Expected a non-empty roadmap with unique item identifiers",
);

const result = RoadmapSchema.parse([
	{
		id: "method-calibration",
		stage: "foundation",
		status: "underway",
		title: "Calibrate method accuracy",
		summary:
			"Measure how well each valuation method anticipates later financing, tender, secondary-market, and IPO reference values.",
		points: [
			"Define comparable reference outcomes and preserve the model version used for every forecast.",
			"Compare IPO-ladder and threshold-curve errors out of sample rather than assuming equal accuracy.",
			"Replace judgment-based weights only after the evidence is large enough to support calibration.",
		],
	},
	{
		id: "historical-evidence",
		stage: "foundation",
		status: "underway",
		title: "Expand the historical evidence record",
		summary:
			"Make past estimates reproducible and show how market inputs, assumptions, and Rai outputs changed over time.",
		points: [
			"Retain source quotes, fitted probabilities, model assumptions, and calculation versions together.",
			"Increase observation frequency when infrastructure and provider terms permit it.",
			"Publish enough history to distinguish an actual trend from a small number of snapshots.",
		],
	},
	{
		id: "company-coverage",
		stage: "coverage",
		status: "underway",
		title: "Add eligible companies and contracts",
		summary:
			"Expand coverage when a company has a complete, verifiable set of markets that maps to a documented Rai method.",
		points: [
			"Prefer complete outcome ladders or coherent threshold sets over isolated headline contracts.",
			"Require canonical source rules, usable quotes, and explicit open-tail assumptions before publication.",
			"Track new private-company markets without lowering the validation standard to increase the ticker count.",
		],
	},
	{
		id: "kalshi-access",
		stage: "coverage",
		status: "permission-gated",
		title: "Evaluate Kalshi as an additional market source",
		summary:
			"Revisit Kalshi only after its data-access, display, attribution, redistribution, and commercial-use requirements are clear for Rai.",
		points: [
			"Obtain written permission or rely on published terms that clearly cover the intended use.",
			"Map contracts only when their resolution rules and valuation targets are comparable to an existing method.",
			"Avoid counting the same underlying prediction twice when venues share information or nearly identical contracts.",
		],
	},
	{
		id: "independent-evidence",
		stage: "coverage",
		status: "candidate",
		title: "Add independent evidence families",
		summary:
			"Test inputs that do not originate from the same prediction-market information set.",
		points: [
			"Evaluate financing rounds, tender offers, secondary transactions, revenue, and comparable-company evidence.",
			"Define a separate schema and uncertainty model for each evidence family.",
			"Combine families only when their valuation basis and calculation date are comparable.",
		],
	},
	{
		id: "rai-stone",
		stage: "instruments",
		status: "concept",
		title: "Research an investable Rai Stone",
		summary:
			"Explore a company-specific instrument whose reference value follows a transparent basket of prediction-market positions and Rai’s published valuation rules.",
		points: [
			"Specify collateral, position sizing, rebalancing, settlement, fees, and a reproducible reference net asset value.",
			"Measure tracking error between the prediction-market position basket and the Rai valuation estimate.",
			"Resolve securities, derivatives, market-access, custody, liquidity, counterparty, tax, and investor-protection requirements with qualified counsel and licensed partners.",
			"An OpenAI Rai Stone would reference a model and position basket; it would not represent shares or ownership in OpenAI.",
		],
	},
]);

if (result.issues) {
	throw new Error(`Invalid public roadmap: ${result.issues.join("; ")}`);
}

export const roadmapItems = result.data;
export type RoadmapItem = (typeof roadmapItems)[number];
