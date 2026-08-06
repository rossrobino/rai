import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const config = await readFile(
	new URL("../vite.config.ts", import.meta.url),
	"utf8",
);
const routes = await readFile(
	new URL("../src/server/routes.tsx", import.meta.url),
	"utf8",
);
const loader = await readFile(
	new URL("../src/client/history/+script.ts", import.meta.url),
	"utf8",
);
const chart = await readFile(
	new URL("../src/client/history/chart.ts", import.meta.url),
	"utf8",
);
const database = await readFile(
	new URL("../src/server/db/index.ts", import.meta.url),
	"utf8",
);

test("the Vercel output registers one daily valuation snapshot", () => {
	assert.match(config, /expiration:\s*600/);
	assert.match(
		config,
		/\{ path: "\/api\/cron\/snapshot-valuations", schedule: "0 12 \* \* \*" \}/,
	);
});

test("the snapshot endpoint requires Vercel's bearer secret", () => {
	assert.match(routes, /process\.env\.CRON_SECRET/);
	assert.match(
		routes,
		/c\.req\.headers\.get\("authorization"\) !== `Bearer \$\{secret\}`/,
	);
	assert.match(routes, /"Cache-Control", "private, no-store"/);
});

test("ECharts is loaded only when historical data is rendered", () => {
	assert.match(loader, /if \(elements\.length > 0\)/);
	assert.match(loader, /import\("\.\/chart"\)/);
	assert.doesNotMatch(loader, /from "echarts/);
});

test("valuation chart hover does not hide unrelated series", () => {
	assert.match(chart, /trigger: "axis"/);
	assert.equal(chart.match(/emphasis: \{ disabled: true \}/g)?.length, 1);
	assert.match(chart, /focus: "none"/);
	assert.match(
		chart,
		/blur:\s*\{[\s\S]*?lineStyle: \{ color, opacity: 0\.76 \}/,
	);
});

test("valuation chart inputs use distinct color, line, and point encodings", () => {
	for (const token of ["series-1", "series-2", "series-3", "series-4"]) {
		assert.match(chart, new RegExp(`--${token}`));
	}
	for (const symbol of ["diamond", "rect", "triangle", "roundRect"]) {
		assert.match(chart, new RegExp(`symbol: "${symbol}"`));
	}
	assert.match(chart, /type: "dashed"/);
	assert.match(chart, /type: "dotted"/);
	assert.equal(chart.match(/opacity: 0\.76/g)?.length, 4);
	assert.match(chart, /lineStyle: \{ color, opacity: 1, width: 2\.75 \}/);
	assert.match(chart, /width: 2,/);
	assert.match(chart, /width: 3\.5/);
});

test("the production database uses libSQL's serverless HTTP driver", () => {
	assert.match(database, /from "drizzle-orm\/libsql\/http"/);
	assert.doesNotMatch(database, /from "drizzle-orm\/libsql"/);
});
