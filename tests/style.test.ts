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
		routes.match(
			/style={`view-transition-name:\$\{companyTransition\([^)]*\)\}`}/g,
		)?.length,
		2,
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
