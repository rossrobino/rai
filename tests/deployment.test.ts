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

test("the production database uses libSQL's serverless HTTP driver", () => {
	assert.match(database, /from "drizzle-orm\/libsql\/http"/);
	assert.doesNotMatch(database, /from "drizzle-orm\/libsql"/);
});
