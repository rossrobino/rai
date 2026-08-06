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
const ui = await readFile(
	new URL("../src/server/ui.tsx", import.meta.url),
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
		"series-1",
		"series-2",
		"series-3",
		"series-4",
		"ink",
		"positive",
		"warning",
		"error",
		"aside",
	]) {
		assert.match(css, new RegExp(`--${token}:\\s*light-dark\\(`));
	}

	assert.match(css, /--base:\s*oklch\(0\.56 0\.018 72\);/);
	assert.match(
		css,
		/--accent:\s*light-dark\(oklch\(0\.52 0\.12 240\), oklch\(0\.71 0\.1 238\)\);/,
	);
	assert.doesNotMatch(ui, /#f2ede4|#171512/);
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
	assert.match(css, /\.source-list article > div\s*\{[^}]*display:\s*grid;/s);
	assert.match(css, /\.source-list \.badge\s*\{[^}]*justify-self:\s*start;/s);
	assert.doesNotMatch(css, /\n\t\.badge\s*\{/);
});

test("valuation comparison rows share aligned grid columns", () => {
	assert.match(
		css,
		/\.valuation-comparison ol\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(10rem, 0\.65fr\) minmax\(8rem, 1fr\) auto auto;/s,
	);
	assert.match(
		css,
		/\.valuation-comparison li\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-template-columns:\s*subgrid;/s,
	);
});

test("valuation cards share the button radius in a compact dashboard grid", () => {
	assert.match(
		css,
		/\.valuation-card\s*\{[^}]*border-radius:\s*var\(--radius\);[^}]*overflow:\s*hidden;/s,
	);
	assert.match(css, /\.market-board\s*\{[^}]*gap:\s*1px;/s);
	assert.match(
		css,
		/\.company-valuation\s*\{[^}]*border-radius:\s*var\(--radius\);[^}]*overflow:\s*hidden;/s,
	);
	assert.match(
		routes,
		/<CompanyMarketCard config=\{config\} load=\{load\} daily \/>/,
	);
	assert.match(css, /\.daily-change\.positive\s*\{[^}]*var\(--positive\)/s);
	assert.match(css, /\.daily-change\.negative\s*\{[^}]*var\(--error\)/s);
});

test("normalization context stays with the probability audit table", () => {
	assert.match(ui, /<tfoot>[\s\S]*?<th>Probability total<\/th>/);
	assert.match(ui, /<details class="audit-disclosure">/);
	assert.match(ui, /This gap is not a Polymarket fee\./);
	assert.doesNotMatch(routes, /Raw binary-market prices total/);
});

test("warnings and limitations stay beside their related data", () => {
	assert.match(ui, /export function Caveat/);
	assert.match(
		ui,
		/<summary title=\{props\.label\} aria-label=\{props\.label\}>/,
	);
	assert.match(routes, /wide\(outcome\)[\s\S]*?Wide bid–ask spread/);
	assert.match(routes, /stale\(outcome\)[\s\S]*?Provider record may be stale/);
	assert.match(routes, /adjusted \|\| tail[\s\S]*?About this fitted threshold/);
	assert.match(routes, /<details class="provider-notice">/);
	assert.equal(
		routes.match(/<details class="shell disclosure disclosure-details">/g)
			?.length,
		2,
	);
	assert.doesNotMatch(routes, /class="(?:shell )?alert warning"/);
	assert.match(css, /\.data-caveat\s*\{[^}]*position:\s*relative;/s);
	assert.match(
		css,
		/@media \(max-width: 620px\)[\s\S]*?\.data-caveat > div\s*\{[^}]*inset-block:\s*auto 1rem;[^}]*inset-inline:\s*1rem;[^}]*position:\s*fixed;/s,
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

test("calculation steps keep readable text on dark sections", () => {
	assert.match(
		css,
		/\.formula-steps h3,[\s\S]*?\.formula-steps h4\s*\{[^}]*color:\s*var\(--ink-foreground\);/s,
	);
	assert.match(
		css,
		/\.formula-steps li > strong\s*\{[^}]*color:\s*var\(--ink-foreground\);/s,
	);
});
