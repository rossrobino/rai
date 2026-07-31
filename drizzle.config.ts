import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ quiet: true });

export default defineConfig({
	schema: "./src/server/db/schema.ts",
	out: "./drizzle",
	dialect: "turso",
	dbCredentials: {
		url: process.env.TURSO_URL ?? "",
		authToken: process.env.TURSO_TOKEN ?? "",
	},
});
