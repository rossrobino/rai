import { adapter } from "@domcojs/vercel";
import { katex } from "@mdit/plugin-katex";
import { md } from "@robino/md";
import { domco } from "domco";
import { readFile, writeFile } from "node:fs/promises";
import { defineConfig, loadEnv } from "vite";
import { MethodSchema } from "./src/server/method-schema.ts";

const deployment = await adapter({
	config: { maxDuration: 60 },
	isr: {
		expiration: 600,
		allowQuery: ["method", "view"],
	},
});
const run = deployment.run;
deployment.run = async () => {
	await run?.();
	const file = new URL(".vercel/output/config.json", import.meta.url);
	const output = JSON.parse(await readFile(file, "utf8"));
	output.crons = [
		{ path: "/api/cron/snapshot-valuations", schedule: "0 12 * * *" },
	];
	await writeFile(file, `${JSON.stringify(output, null, "\t")}\n`);
};

export default defineConfig(({ mode }) => {
	Object.assign(process.env, loadEnv(mode, ".", ""));

	return {
		plugins: [
			md({
				FrontmatterSchema: MethodSchema,
				plugins: [katex],
			}),
			domco({
				adapter: deployment,
			}),
		],
	};
});
