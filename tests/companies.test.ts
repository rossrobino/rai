import assert from "node:assert/strict";
import test from "node:test";
import { companyData } from "../src/server/company-data";
import {
	CompanyCatalogSchema,
	CompanySchema,
} from "../src/server/company-schema";
import { companies } from "../src/server/companies";

test("OVR schema validates the company catalog", () => {
	const result = CompanyCatalogSchema.parse(companyData);

	assert.equal(result.issues, undefined);
	assert.deepEqual(
		companies.map((company) => company.slug),
		["anthropic", "openai", "perplexity", "oura", "strava", "discord"],
	);
	assert.ok(
		companies.every(
			(company) =>
				company.methods.length > 0 &&
				company.methods.reduce((sum, method) => sum + method.weight, 0) > 0,
		),
	);
});

test("a company accepts multiple independently weighted methods", () => {
	const company = companies[0];
	const method = company?.methods[0];
	assert.ok(company && method);

	const result = CompanySchema.parse({
		...company,
		methods: [
			{ ...method, id: "market-view", weight: 1 },
			{ ...method, id: "second-view", weight: 2 },
		],
	});

	assert.equal(result.issues, undefined);
	assert.deepEqual(
		result.data?.methods.map((value) => value.weight),
		[1, 2],
	);
});

test("a company rejects a zero total method weight", () => {
	const company = companies[0];
	assert.ok(company);

	const result = CompanySchema.parse({
		...company,
		methods: company.methods.map((method) => ({ ...method, weight: 0 })),
	});

	assert.ok(result.issues);
});

test("every company has one complete, contiguous IPO ladder", () => {
	for (const company of companies) {
		for (const method of company.methods) {
			if (method.method !== "prediction-market-ipo") continue;

			const ranges = method.data.outcomes
				.filter((market) => market.kind === "range")
				.sort((a, b) => a.sortOrder - b.sortOrder);
			const noIpo = method.data.outcomes.filter(
				(market) => market.kind === "no_ipo",
			);

			assert.equal(noIpo.length, 1, `${company.name} needs one no-IPO outcome`);
			assert.equal(
				ranges[0]?.lower,
				null,
				`${company.name} needs a lower tail`,
			);
			assert.equal(
				ranges.at(-1)?.upper,
				null,
				`${company.name} needs an upper tail`,
			);

			for (let i = 1; i < ranges.length; i += 1) {
				assert.equal(
					ranges[i - 1]?.upper,
					ranges[i]?.lower,
					`${company.name} has a gap or overlap`,
				);
			}

			for (const range of ranges) {
				assert.notEqual(range.representativeValue, null);
				if (range.lower != null) {
					assert.ok(
						range.representativeValue != null &&
							range.representativeValue >= range.lower,
					);
				}
				if (range.upper != null) {
					assert.ok(
						range.representativeValue != null &&
							range.representativeValue <= range.upper,
					);
				}
			}
		}
	}
});

test("valuation thresholds are strictly ordered with explicit tails", () => {
	const assigned = companies.flatMap((company) =>
		company.methods
			.filter(
				(method) => method.method === "prediction-market-valuation-thresholds",
			)
			.map((method) => ({ company, method })),
	);
	assert.deepEqual(
		assigned.map(({ company }) => company.slug),
		["anthropic", "openai", "perplexity"],
	);

	for (const { company, method } of assigned) {
		assert.equal(method.data.provider, "polymarket");
		for (let i = 1; i < method.data.thresholds.length; i += 1) {
			assert.ok(
				(method.data.thresholds[i]?.value ?? 0) >
					(method.data.thresholds[i - 1]?.value ?? 0),
				`${company.name} thresholds must increase`,
			);
		}
		const thresholds = method.data.thresholds;
		assert.ok(
			method.assumptions.floorValue < (thresholds[0]?.value ?? 0),
			`${company.name} needs a lower-tail floor`,
		);
		assert.ok(
			method.assumptions.upperValue >= (thresholds.at(-1)?.value ?? 0),
			`${company.name} needs an upper-tail representative`,
		);
		assert.ok(
			method.data.claim.rulesUrl.startsWith("https://polymarket.com/"),
			`${company.name} needs source rules`,
		);
	}
});

test("every active assignment uses Polymarket", () => {
	for (const method of companies.flatMap((company) => company.methods)) {
		assert.equal(method.data.provider, "polymarket");
	}
});
