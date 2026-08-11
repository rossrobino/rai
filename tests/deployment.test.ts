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
const alpha = await readFile(
	new URL("../src/server/alpha-vantage.ts", import.meta.url),
	"utf8",
);
const database = await readFile(
	new URL("../src/server/db/index.ts", import.meta.url),
	"utf8",
);
const layout = await readFile(
	new URL("../src/server/ui.tsx", import.meta.url),
	"utf8",
);
const analytics = await readFile(
	new URL("../src/client/analytics/+script.ts", import.meta.url),
	"utf8",
);
const pkg = JSON.parse(
	await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

test("the Vercel output registers one daily valuation snapshot", () => {
	assert.match(config, /expiration:\s*600/);
	assert.match(
		config,
		/\{ path: "\/api\/cron\/snapshot-valuations", schedule: "0 12 \* \* \*" \}/,
	);
});

test("the daily snapshot job also stores QQQ history", () => {
	assert.match(routes, /fetchQqq\(\)\.catch\(\(\) => null\)/);
	assert.match(routes, /recordMarketPrices\(prices\)/);
	assert.match(routes, /symbol: "QQQ"/);
	assert.match(alpha, /function", "TIME_SERIES_DAILY"/);
	assert.match(alpha, /symbol", qqqSymbol/);
	assert.match(alpha, /outputsize", "compact"/);
});

test("Vercel Analytics is bundled for full-page navigation", () => {
	assert.equal(typeof pkg.dependencies["@vercel/analytics"], "string");
	assert.match(analytics, /import \{ inject \} from "@vercel\/analytics"/);
	assert.match(analytics, /inject\(\)/);
	assert.match(
		layout,
		/import \* as analyticsScript from "client:script\/analytics"/,
	);
	assert.match(layout, /Render\.html\(analyticsScript\.tags\)/);
});

test("same-origin speculation prefetches without executing analytics", () => {
	assert.match(layout, /prefetch:\s*\[/);
	assert.doesNotMatch(layout, /prerender:\s*\[/);
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
	assert.equal(chart.match(/emphasis: \{ disabled: true \}/g)?.length, 4);
	assert.match(chart, /focus: "none"/);
	assert.match(
		chart,
		/blur:\s*\{[\s\S]*?lineStyle: \{ color, opacity: 0\.76 \}/,
	);
});

test("valuation history switches between dollar and normalized peer views", () => {
	assert.match(routes, /data-history-view="valuation"/);
	assert.match(routes, /data-history-view="performance"/);
	assert.match(routes, /data-history-range="week"/);
	assert.match(routes, /data-history-range="max"/);
	assert.match(chart, /Rai Index \(ex \$\{company\}\)/);
	assert.match(chart, /name: "QQQ"/);
	assert.match(chart, /point\.qqq/);
	assert.match(chart, /const qqq = visible\.some/);
	assert.match(chart, /normalize\(/);
	assert.match(chart, /latest - 7 \* day/);
	assert.match(chart, /splitNumber: compact \? 3 : 6/);
	assert.match(chart, /hideOverlap: true/);
});

test("valuation chart uses clean lines and a restrained current-value pulse", () => {
	assert.match(chart, /import \{ EffectScatterChart, LineChart \}/);
	assert.equal(chart.match(/showSymbol: false/g)?.length, 5);
	assert.match(chart, /type: "effectScatter"/);
	assert.match(chart, /clip: false/);
	assert.match(
		chart,
		/rippleEffect:\s*\{[^}]*brushType: "stroke",[^}]*number: 1,[^}]*period: 6,[^}]*scale: 1\.8,/s,
	);
	assert.match(chart, /showEffectOn: reduced \? "emphasis" : "render"/);
	assert.match(chart, /silent: true/);
	assert.match(chart, /tooltip: \{ show: false \}/);
});

test("valuation chart inputs use distinct color and line encodings", () => {
	for (const token of ["series-1", "series-2", "series-3", "series-4"]) {
		assert.match(chart, new RegExp(`--${token}`));
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
