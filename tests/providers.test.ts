import assert from "node:assert/strict";
import test from "node:test";
import { companies } from "../src/server/companies";
import { getMethodProviders, providers } from "../src/server/providers";

test("public prediction-market APIs are configured as active providers", () => {
	assert.deepEqual(
		providers
			.filter((provider) => provider.status === "active")
			.map((provider) => provider.id),
		["polymarket"],
	);
	assert.equal(providers.length, 1);
});

test("every active method assignment has an active provider record", () => {
	for (const method of companies.flatMap((company) => company.methods)) {
		for (const id of [method.data.provider]) {
			const provider = providers.find((value) => value.id === id);
			assert.ok(
				provider?.status === "active" &&
					getMethodProviders(method.method).some(
						(value) => value.id === provider.id,
					),
				`${method.id} needs its assigned provider to be active`,
			);
		}
	}
});
