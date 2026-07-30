import { adapter } from "@domcojs/vercel";
import { katex } from "@mdit/plugin-katex";
import { md } from "@robino/md";
import { domco } from "domco";
import { defineConfig } from "vite";
import { MethodSchema } from "./src/server/method-schema";

export default defineConfig({
	plugins: [
		md({
			FrontmatterSchema: MethodSchema,
			plugins: [katex],
		}),
		domco({
			adapter: adapter({
				isr: {
					expiration: 600,
					allowQuery: ["method", "view"],
				},
			}),
		}),
	],
});
