import { and, asc, desc, eq, inArray, lt, ne } from "drizzle-orm";
import type { MarketPrice } from "@/server/alpha-vantage";
import { getDatabase } from "@/server/db";
import {
	marketPrices,
	valuationInputs,
	valuationRuns,
	valuationSnapshots,
} from "@/server/db/schema";

export type ValuationObservation = {
	companyId: string;
	companySlug: string;
	value: number;
	low: number;
	high: number;
	methodCount: number;
	unavailableMethodCount: number;
	sourceFetchedAt?: string;
	inputs: {
		methodId: string;
		method: string;
		family: string;
		label: string;
		value: number;
		weight: number;
	}[];
};

export type ValuationHistoryPoint = {
	id: string;
	observedAt: string;
	value: number;
	benchmark: number | null;
	qqq: number | null;
	peerCount: number;
	low: number;
	high: number;
	methodCount: number;
	unavailableMethodCount: number;
	inputs: {
		methodId: string;
		label: string;
		value: number;
		weight: number;
	}[];
};

type PeerRun = {
	observedAt: string;
	values: { companyId: string; value: number }[];
};

/** Aligns market closes to calendar observations using the latest prior close. */
export function alignPrices(
	buckets: string[],
	prices: Array<{ date: string; close: number }>,
) {
	const ordered = prices.toSorted((a, b) => a.date.localeCompare(b.date));
	let i = 0;
	let close: number | null = null;
	return buckets.map((bucket) => {
		let price = ordered[i];
		while (price && price.date <= bucket) {
			close = price.close;
			i += 1;
			price = ordered[i];
		}
		return close;
	});
}

/** Compounds equal-weight daily returns for a leave-one-out company index. */
export function peerIndex(runs: PeerRun[]) {
	let level = 100;
	return runs.map((run, i) => {
		const current = new Map(
			run.values
				.filter(({ value }) => Number.isFinite(value) && value > 0)
				.map(({ companyId, value }) => [companyId, value]),
		);
		if (i === 0) {
			return {
				observedAt: run.observedAt,
				value: current.size > 0 ? level : null,
				companies: current.size,
			};
		}

		const previous = new Map(
			(runs[i - 1]?.values ?? [])
				.filter(({ value }) => Number.isFinite(value) && value > 0)
				.map(({ companyId, value }) => [companyId, value]),
		);
		const changes = [...current].flatMap(([companyId, value]) => {
			const prior = previous.get(companyId);
			return prior == null ? [] : [value / prior - 1];
		});
		if (changes.length === 0) {
			return { observedAt: run.observedAt, value: null, companies: 0 };
		}

		level *=
			1 + changes.reduce((sum, value) => sum + value, 0) / changes.length;
		return {
			observedAt: run.observedAt,
			value: level,
			companies: changes.length,
		};
	});
}

/** Calculates annualized realized volatility from up to 30 daily valuation changes. */
export function realizedVolatility(
	points: Pick<ValuationHistoryPoint, "value">[],
	window = 30,
	minimum = 7,
) {
	const values = points.slice(-(window + 1)).map((point) => point.value);
	if (
		values.length <= minimum ||
		values.some((value) => !Number.isFinite(value) || value <= 0)
	) {
		return undefined;
	}

	const changes = values
		.slice(1)
		.map((value, i) => Math.log(value / (values[i] ?? value)));
	const mean = changes.reduce((sum, value) => sum + value, 0) / changes.length;
	const variance =
		changes.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
		(changes.length - 1);

	return {
		value: Math.sqrt(variance * 365),
		days: changes.length,
	};
}

const easternDay = new Intl.DateTimeFormat("en-CA", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	timeZone: "America/New_York",
});

function timestamp(value?: string) {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.valueOf()) ? null : date;
}

export async function recordValuations(
	observations: ValuationObservation[],
	failures: number,
	observedAt = new Date(),
	db = getDatabase(),
) {
	const runId = crypto.randomUUID();
	const bucket = easternDay.format(observedAt);
	const inserted = await db.transaction(async (tx) => {
		const run = await tx
			.insert(valuationRuns)
			.values({
				id: runId,
				bucket,
				observedAt,
				completedAt: new Date(),
				companyCount: observations.length,
				failureCount: failures,
			})
			.onConflictDoNothing({ target: valuationRuns.bucket })
			.returning({ id: valuationRuns.id });
		if (!run[0]) return false;

		if (observations.length > 0) {
			await tx.insert(valuationSnapshots).values(
				observations.map((observation) => ({
					id: `${runId}:${observation.companyId}`,
					runId,
					companyId: observation.companyId,
					companySlug: observation.companySlug,
					value: observation.value,
					low: observation.low,
					high: observation.high,
					methodCount: observation.methodCount,
					unavailableMethodCount: observation.unavailableMethodCount,
					sourceFetchedAt: timestamp(observation.sourceFetchedAt),
				})),
			);

			const inputs = observations.flatMap((observation) =>
				observation.inputs.map((input) => ({
					id: `${runId}:${observation.companyId}:${input.methodId}`,
					snapshotId: `${runId}:${observation.companyId}`,
					methodId: input.methodId,
					method: input.method,
					family: input.family,
					label: input.label,
					value: input.value,
					weight: input.weight,
				})),
			);
			if (inputs.length > 0) await tx.insert(valuationInputs).values(inputs);
		}

		return true;
	});

	return { inserted, runId: inserted ? runId : undefined, bucket };
}

/** Stores previously unseen market closes returned by a benchmark provider. */
export async function recordMarketPrices(
	prices: MarketPrice[],
	db = getDatabase(),
) {
	if (prices.length === 0) return { inserted: 0 };
	const inserted = await db
		.insert(marketPrices)
		.values(
			prices.map((price) => ({
				id: `${price.symbol}:${price.date}`,
				symbol: price.symbol,
				date: price.date,
				close: price.close,
				provider: price.provider,
				fetchedAt: new Date(price.fetchedAt),
			})),
		)
		.onConflictDoNothing({
			target: [marketPrices.symbol, marketPrices.date],
		})
		.returning({ id: marketPrices.id });

	return { inserted: inserted.length };
}

/** Returns the latest stored valuation from an earlier US Eastern calendar day. */
export async function getPreviousValuation(
	companyId: string,
	before = new Date(),
	db = getDatabase(),
) {
	const point = (
		await db
			.select({
				observedAt: valuationRuns.observedAt,
				value: valuationSnapshots.value,
			})
			.from(valuationSnapshots)
			.innerJoin(valuationRuns, eq(valuationSnapshots.runId, valuationRuns.id))
			.where(
				and(
					eq(valuationSnapshots.companyId, companyId),
					lt(valuationRuns.bucket, easternDay.format(before)),
				),
			)
			.orderBy(desc(valuationRuns.bucket))
			.limit(1)
	)[0];

	return point
		? { observedAt: point.observedAt.toISOString(), value: point.value }
		: undefined;
}

export async function getValuationHistory(
	companyId: string,
	limit = 365,
	db = getDatabase(),
) {
	const snapshots = await db
		.select({
			id: valuationSnapshots.id,
			runId: valuationSnapshots.runId,
			bucket: valuationRuns.bucket,
			observedAt: valuationRuns.observedAt,
			value: valuationSnapshots.value,
			low: valuationSnapshots.low,
			high: valuationSnapshots.high,
			methodCount: valuationSnapshots.methodCount,
			unavailableMethodCount: valuationSnapshots.unavailableMethodCount,
		})
		.from(valuationSnapshots)
		.innerJoin(valuationRuns, eq(valuationSnapshots.runId, valuationRuns.id))
		.where(eq(valuationSnapshots.companyId, companyId))
		.orderBy(desc(valuationRuns.observedAt))
		.limit(limit);
	if (snapshots.length === 0) return [];

	const [inputs, peers, prices] = await Promise.all([
		db
			.select({
				snapshotId: valuationInputs.snapshotId,
				methodId: valuationInputs.methodId,
				label: valuationInputs.label,
				value: valuationInputs.value,
				weight: valuationInputs.weight,
			})
			.from(valuationInputs)
			.where(
				inArray(
					valuationInputs.snapshotId,
					snapshots.map(({ id }) => id),
				),
			)
			.orderBy(asc(valuationInputs.methodId)),
		db
			.select({
				runId: valuationSnapshots.runId,
				companyId: valuationSnapshots.companyId,
				value: valuationSnapshots.value,
			})
			.from(valuationSnapshots)
			.where(
				and(
					inArray(
						valuationSnapshots.runId,
						snapshots.map(({ runId }) => runId),
					),
					ne(valuationSnapshots.companyId, companyId),
				),
			),
		db
			.select({ date: marketPrices.date, close: marketPrices.close })
			.from(marketPrices)
			.where(eq(marketPrices.symbol, "QQQ"))
			.orderBy(asc(marketPrices.date)),
	]);
	const grouped = Map.groupBy(inputs, (input) => input.snapshotId);
	const companies = Map.groupBy(peers, (peer) => peer.runId);
	const ordered = snapshots.reverse();
	const benchmark = peerIndex(
		ordered.map((snapshot) => ({
			observedAt: snapshot.observedAt.toISOString(),
			values: companies.get(snapshot.runId) ?? [],
		})),
	);
	const qqq = alignPrices(
		ordered.map((snapshot) => snapshot.bucket),
		prices,
	);

	return ordered.map((snapshot, i): ValuationHistoryPoint => ({
		id: snapshot.id,
		observedAt: snapshot.observedAt.toISOString(),
		value: snapshot.value,
		benchmark: benchmark[i]?.value ?? null,
		qqq: qqq[i] ?? null,
		peerCount: benchmark[i]?.companies ?? 0,
		low: snapshot.low,
		high: snapshot.high,
		methodCount: snapshot.methodCount,
		unavailableMethodCount: snapshot.unavailableMethodCount,
		inputs: grouped.get(snapshot.id) ?? [],
	}));
}
