import { Schema } from "ovr";

const qqqSymbol = "QQQ";

const ResponseSchema = Schema.object({
	"Meta Data": Schema.object({
		"2. Symbol": Schema.string().min(1),
	}),
	"Time Series (Daily)": Schema.unknown(),
});

const PriceSchema = Schema.object({
	"4. close": Schema.string().min(1),
});

export type MarketPrice = {
	symbol: string;
	date: string;
	close: number;
	provider: "alpha-vantage";
	fetchedAt: string;
};

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value != null && !Array.isArray(value);
}

/** Fetches Alpha Vantage's compact raw daily closing-price history for QQQ. */
export async function fetchQqq(
	key = process.env.ALPHA_VANTAGE_API_KEY,
	request: (
		input: string | URL,
		init?: RequestInit,
	) => Promise<Response> = fetch,
) {
	if (!key) throw new Error("ALPHA_VANTAGE_API_KEY is not configured.");

	const url = new URL("https://www.alphavantage.co/query");
	url.searchParams.set("function", "TIME_SERIES_DAILY");
	url.searchParams.set("symbol", qqqSymbol);
	url.searchParams.set("outputsize", "compact");
	url.searchParams.set("apikey", key);
	const response = await request(url, {
		headers: { accept: "application/json" },
		signal: AbortSignal.timeout(8_000),
	});
	if (!response.ok) {
		throw new Error(`Alpha Vantage returned HTTP ${response.status}.`);
	}

	const result = ResponseSchema.parse(await response.json());
	if (
		result.issues ||
		result.data["Meta Data"]["2. Symbol"] !== qqqSymbol ||
		!record(result.data["Time Series (Daily)"])
	) {
		throw new Error("Alpha Vantage returned invalid QQQ daily data.");
	}

	const fetchedAt = new Date().toISOString();
	const prices: MarketPrice[] = [];
	for (const [date, value] of Object.entries(
		result.data["Time Series (Daily)"],
	)) {
		const point = PriceSchema.parse(value);
		const close = point.issues ? Number.NaN : Number(point.data["4. close"]);
		if (
			!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
			Number.isNaN(new Date(`${date}T00:00:00Z`).valueOf()) ||
			!Number.isFinite(close) ||
			close <= 0
		) {
			throw new Error("Alpha Vantage returned an invalid QQQ daily price.");
		}
		prices.push({
			symbol: qqqSymbol,
			date,
			close,
			provider: "alpha-vantage",
			fetchedAt,
		});
	}
	if (prices.length === 0) {
		throw new Error("Alpha Vantage returned no QQQ daily prices.");
	}

	return prices.sort((a, b) => a.date.localeCompare(b.date));
}
