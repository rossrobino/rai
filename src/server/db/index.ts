import { drizzle } from "drizzle-orm/libsql/http";
import * as schema from "@/server/db/schema";

function connect() {
	const url = process.env.TURSO_URL;
	const authToken = process.env.TURSO_TOKEN;
	if (!url || !authToken) {
		throw new Error("TURSO_URL and TURSO_TOKEN must be configured.");
	}

	return drizzle({ connection: { url, authToken }, schema });
}

let database: ReturnType<typeof connect> | undefined;

export function getDatabase() {
	return (database ??= connect());
}
