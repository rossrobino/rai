import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { roadmapItems } from "../src/server/roadmap";

const routes = await readFile(
	new URL("../src/server/routes.tsx", import.meta.url),
	"utf8",
);

test("the public roadmap has unique, validated workstreams", () => {
	assert.equal(roadmapItems.length, 6);
	assert.equal(
		new Set(roadmapItems.map((item) => item.id)).size,
		roadmapItems.length,
	);
	assert.deepEqual(
		new Set(roadmapItems.map((item) => item.stage)),
		new Set(["foundation", "coverage", "instruments"]),
	);
});

test("the roadmap preserves provider permissions as an explicit gate", () => {
	const kalshi = roadmapItems.find((item) => item.id === "kalshi-access");

	assert.equal(kalshi?.status, "permission-gated");
	assert.match(kalshi?.summary ?? "", /data-access, display, attribution/);
});

test("the Rai Stone remains a clearly bounded research concept", () => {
	const stone = roadmapItems.find((item) => item.id === "rai-stone");

	assert.equal(stone?.status, "concept");
	assert.ok(
		stone?.points.some((point) => /would not represent shares/.test(point)),
	);
	assert.match(routes, /No Rai Stone exists today\./);
	assert.match(
		routes,
		/not a product announcement, offering, or launch schedule/,
	);
});

test("the roadmap is a public OVR route in the primary navigation", () => {
	assert.match(routes, /export const roadmap = Route\.get\("\/roadmap"/);
	assert.match(routes, /<roadmap\.Anchor>Roadmap<\/roadmap\.Anchor>/);
	assert.match(routes, /title="Public roadmap"/);
	assert.match(routes, /description="Rai’s public roadmap/);
});
