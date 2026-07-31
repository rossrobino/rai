import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(
	new URL("../src/client/+style.css", import.meta.url),
	"utf8",
);
const routes = await readFile(
	new URL("../src/server/routes.tsx", import.meta.url),
	"utf8",
);

test("the project theme extends UICO and supports both color schemes", () => {
	assert.ok(
		css.indexOf('@import "uico/style.css"') <
			css.indexOf("@layer theme, base, components, utilities"),
	);
	assert.match(css, /color-scheme:\s*light dark/);

	for (const token of [
		"background",
		"surface",
		"foreground",
		"heading-foreground",
		"muted-foreground",
		"line",
		"primary-background",
		"accent",
		"ink",
		"positive",
		"warning",
		"error",
		"aside",
	]) {
		assert.match(css, new RegExp(`--${token}:\\s*light-dark\\(`));
	}
});

test("numeric text uses tabular figures throughout the document", () => {
	assert.match(
		css,
		/@layer utilities\s*\{\s*:where\(\*\)\s*\{[^}]*font-variant-numeric:\s*tabular-nums;/s,
	);
});

test("source market cards keep long quotes and metadata within their grid", () => {
	assert.match(
		css,
		/\.source-list\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/s,
	);
	assert.match(
		css,
		/\.source-list article\s*\{[^}]*align-content:\s*start;[^}]*grid-template-columns:\s*minmax\(0, 1fr\);[^}]*min-inline-size:\s*0;/s,
	);
	assert.match(
		css,
		/\.source-list \.badge\s*\{[^}]*max-inline-size:\s*100%;[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s,
	);
});

test("company tiles use an accessible cross-document view transition", () => {
	assert.match(
		css,
		/@media \(prefers-reduced-motion: no-preference\)\s*\{[\s\S]*?@view-transition\s*\{\s*navigation:\s*auto;/,
	);
	assert.match(
		css,
		/::view-transition-group\(\*\)\s*\{[^}]*animation-duration:\s*var\(--motion-view\);[^}]*animation-timing-function:\s*var\(--ease-in-out\);/s,
	);
	assert.equal(
		routes.match(/view-transition-name:\$\{companyTransition\([^)]*\)\}/g)
			?.length,
		2,
	);
	assert.equal(
		routes.match(/view-transition-name:\$\{valuationTransition\([^)]*\)\}/g)
			?.length,
		2,
	);
	assert.equal(
		routes.match(/style={`view-transition-name:\$\{dashboardTransition\}`}/g)
			?.length,
		2,
	);
	assert.match(
		routes,
		/<CompanyMarketCard[\s\S]*?transition=\{false\}[\s\S]*?\/>/,
	);
	assert.match(
		css,
		/\.hero\s*\{[^}]*gap:\s*clamp\(3rem, 6vw, 6rem\);[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(24rem, 28rem\);/s,
	);
});

test("component colors resolve through semantic theme tokens", () => {
	const rules = css.slice(css.indexOf("@layer base"));

	assert.doesNotMatch(rules, /#[\da-f]{3,8}\b/i);
	assert.doesNotMatch(rules, /\brgba?\(/i);
	assert.doesNotMatch(
		rules,
		/(?:color|background(?:-color)?):\s*(?:white|black)\s*;/i,
	);
});
