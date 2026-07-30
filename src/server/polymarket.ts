import type {
	PredictionIpoMethod,
	PredictionThresholdMethod,
} from "@/server/company-schema";
import type { Outcome, ThresholdObservation } from "@/server/model";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value != null && !Array.isArray(value);
}

function text(value: unknown, name: string) {
	if (typeof value !== "string" || !value.trim()) {
		throw new Error(`Polymarket response is missing ${name}.`);
	}
	return value;
}

function optionalText(value: unknown) {
	return typeof value === "string" && value.trim() ? value : null;
}

function number(value: unknown) {
	const parsed =
		typeof value === "number"
			? value
			: typeof value === "string"
				? Number(value)
				: Number.NaN;
	return Number.isFinite(parsed) ? parsed : null;
}

function strings(value: unknown) {
	if (typeof value !== "string") return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		return [];
	}
	return Array.isArray(parsed)
		? parsed.filter((item): item is string => typeof item === "string")
		: [];
}

function includesDate(value: string, date: string) {
	const parsed = new Date(`${date}T12:00:00Z`);
	if (!Number.isFinite(parsed.getTime())) return false;
	const long = new Intl.DateTimeFormat("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}).format(parsed);
	const short = new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}).format(parsed);
	return value.includes(date) || value.includes(long) || value.includes(short);
}

const cache = new Map<string, { expires: number; request: Promise<unknown> }>();

async function json(url: string, ttl = 60_000) {
	const found = cache.get(url);
	if (found && found.expires > Date.now()) return found.request;

	const request = fetch(url, {
		headers: { accept: "application/json" },
		signal: AbortSignal.timeout(8_000),
	}).then(async (response) => {
		if (!response.ok) {
			throw new Error(`Polymarket returned HTTP ${response.status}.`);
		}
		return response.json() as Promise<unknown>;
	});
	cache.set(url, { expires: Date.now() + ttl, request });

	try {
		return await request;
	} catch (error) {
		cache.delete(url);
		throw error;
	}
}

function parseEvent(value: unknown, expectedSlug: string) {
	if (!isRecord(value)) {
		throw new Error("Polymarket returned an invalid event.");
	}
	const slug = text(value.slug, "event slug");
	if (slug !== expectedSlug) {
		throw new Error(`Polymarket returned an unexpected event: ${slug}.`);
	}
	if (!Array.isArray(value.markets)) {
		throw new Error(`Polymarket event ${slug} has no markets.`);
	}
	return {
		slug,
		title: text(value.title, "event title"),
		description: text(value.description, "event rules"),
		resolutionSource: optionalText(value.resolutionSource),
		updatedAt: optionalText(value.updatedAt),
		markets: value.markets,
	};
}

async function fetchEvents(
	events: Array<{ id: string; slug: string; url: string; api: string }>,
) {
	const values = await Promise.all(
		events.map(async (event) => ({
			...parseEvent(await json(event.api), event.slug),
			id: event.id,
			url: event.url,
		})),
	);
	return { fetchedAt: new Date().toISOString(), values };
}

async function fetchParticipants(conditionId: string) {
	const wallets = new Set<string>();
	for (const offset of [0, 10_000]) {
		const url = new URL("https://data-api.polymarket.com/trades");
		url.searchParams.set("market", conditionId);
		url.searchParams.set("limit", "10000");
		url.searchParams.set("offset", String(offset));
		url.searchParams.set("takerOnly", "false");
		const value = await json(url.toString(), 5 * 60_000);
		if (!Array.isArray(value)) {
			throw new Error("Polymarket returned invalid participant data.");
		}
		for (const trade of value) {
			if (isRecord(trade) && typeof trade.proxyWallet === "string") {
				wallets.add(trade.proxyWallet);
			}
		}
		if (value.length < 10_000) return wallets.size;
	}
	return null;
}

function quote(market: Record<string, unknown>, label: string) {
	const bid = number(market.bestBid);
	const ask = number(market.bestAsk);
	const lastTrade = number(market.lastTradePrice);
	if (bid != null && ask != null && bid > ask) {
		throw new Error(`Crossed Polymarket quote for ${label}.`);
	}

	const outcomes = strings(market.outcomes);
	const prices = strings(market.outcomePrices).map(number);
	const yes = outcomes.findIndex(
		(outcome) => outcome.toLocaleLowerCase("en-US") === "yes",
	);
	const fallback = yes >= 0 ? (prices[yes] ?? null) : null;
	const rawProbability =
		bid != null && ask != null
			? (bid + ask) / 2
			: lastTrade != null
				? lastTrade
				: fallback;
	if (rawProbability == null || rawProbability < 0 || rawProbability > 1) {
		throw new Error(`No valid probability for ${label}.`);
	}

	return {
		bid,
		ask,
		lastTrade,
		rawProbability,
		selectedMethod:
			bid != null && ask != null
				? "Displayed bid–ask midpoint"
				: lastTrade != null
					? "Last trade"
					: "Gamma Yes price",
		sourceUpdatedAt: optionalText(market.updatedAt),
	};
}

/** Fetches and validates the IPO-ladder markets configured for one method. */
export async function fetchCompanyMarkets(method: PredictionIpoMethod) {
	const { fetchedAt, values } = await fetchEvents(method.data.events);
	const outcomes: Outcome[] = [];
	for (const mapping of method.data.outcomes) {
		const event = values.find((value) => value.id === mapping.event);
		const market = event?.markets.find(
			(value) =>
				isRecord(value) &&
				typeof value.groupItemTitle === "string" &&
				value.groupItemTitle === mapping.sourceTitle,
		);
		if (!event || !isRecord(market)) {
			throw new Error(`Missing expected Polymarket outcome: ${mapping.label}.`);
		}

		const selected = quote(market, mapping.label);
		const slug = text(market.slug, "market slug");
		outcomes.push({
			key: mapping.key,
			label: mapping.label,
			kind: mapping.kind,
			lower: mapping.lower,
			upper: mapping.upper,
			representativeValue:
				mapping.kind === "range" && mapping.lower == null
					? method.assumptions.lowerValue
					: mapping.key === method.upperKey
						? method.assumptions.upperValue
						: mapping.representativeValue,
			rawProbability: selected.rawProbability,
			sourceEvent: event.title,
			sourceMarket: slug,
			sourceQuestion: text(market.question, "market question"),
			selectedMethod: selected.selectedMethod,
			bid: selected.bid,
			ask: selected.ask,
			lastTrade: selected.lastTrade,
			volume: number(market.volume),
			liquidity: number(market.liquidity),
			sourceUrl: `${event.url}/${slug}`,
			sourceUpdatedAt: selected.sourceUpdatedAt ?? event.updatedAt,
			fetchedAt,
			sortOrder: mapping.sortOrder,
		});
	}

	return outcomes.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Fetches one semantically declared Polymarket threshold curve. */
export async function fetchThresholdMarkets(
	method: PredictionThresholdMethod,
	participants = true,
) {
	const { fetchedAt, values } = await fetchEvents(method.data.events);
	const rules = values.find(
		(event) => event.url === method.data.claim.rulesUrl,
	);
	if (
		!rules ||
		!rules.description.includes("NPM Price") ||
		!includesDate(rules.description, method.data.claim.deadline)
	) {
		throw new Error(
			"Polymarket threshold rules no longer match the configured canonical claim.",
		);
	}

	const thresholds: ThresholdObservation[] = await Promise.all(
		method.data.thresholds.map(async (mapping) => {
			const event = values.find((value) => value.id === mapping.event);
			const market = event?.markets.find(
				(value) =>
					isRecord(value) &&
					typeof value.groupItemTitle === "string" &&
					value.groupItemTitle === mapping.sourceTitle,
			);
			if (!event || !isRecord(market)) {
				throw new Error(
					`Missing expected Polymarket threshold: ${mapping.label}.`,
				);
			}
			const description = text(market.description, "market rules");
			if (
				!description.includes("NPM Price") ||
				!includesDate(description, method.data.claim.deadline)
			) {
				throw new Error(
					`Polymarket rules changed for threshold ${mapping.label}.`,
				);
			}

			const selected = quote(market, mapping.label);
			const slug = text(market.slug, "market slug");
			const conditionId = text(market.conditionId, "condition ID");
			return {
				key: mapping.key,
				label: mapping.label,
				value: mapping.value,
				provider: method.data.provider,
				rawProbability: selected.rawProbability,
				sourceEvent: event.title,
				sourceMarket: slug,
				sourceQuestion: text(market.question, "market question"),
				selectedMethod: selected.selectedMethod,
				bid: selected.bid,
				ask: selected.ask,
				lastTrade: selected.lastTrade,
				volume: number(market.volume),
				liquidity: number(market.liquidity),
				participants: participants
					? await fetchParticipants(conditionId).catch(() => null)
					: null,
				sourceUrl: `${event.url}/${slug}`,
				sourceUpdatedAt: selected.sourceUpdatedAt ?? event.updatedAt,
				fetchedAt,
				sortOrder: mapping.sortOrder,
			};
		}),
	);
	return thresholds.sort((a, b) => a.sortOrder - b.sortOrder);
}
