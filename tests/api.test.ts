import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routes = await readFile(
	new URL("../src/server/routes.tsx", import.meta.url),
	"utf8",
);

test("the public API exposes discovery, catalog, company, and calculation routes", () => {
	for (const path of [
		"/api",
		"/api/companies",
		"/api/companies/:name",
		"/api/companies/:name/methods/:method",
	]) {
		assert.match(
			routes,
			new RegExp(`Route\\.get\\(\\s*"${path.replaceAll("/", "\\/")}"`),
		);
	}
});

test("public API responses declare units and allow cross-origin reads", () => {
	assert.match(routes, /headers\.set\("Access-Control-Allow-Origin", "\*"\)/);
	assert.match(routes, /monetaryValues: "millions of USD"/);
	assert.match(routes, /probabilities: "decimal values from 0 to 1"/);
});

test("company method pages link to the calculation API", () => {
	assert.match(routes, /<apiCalculation\.Anchor[\s\S]*?View API response/);
	assert.doesNotMatch(routes, /Export current JSON/);
});
