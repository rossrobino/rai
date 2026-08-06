import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import { getDatabase } from "@/server/db";
import {
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

	const inputs = await db
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
		.orderBy(asc(valuationInputs.methodId));
	const grouped = Map.groupBy(inputs, (input) => input.snapshotId);

	return snapshots.reverse().map((snapshot): ValuationHistoryPoint => ({
		...snapshot,
		observedAt: snapshot.observedAt.toISOString(),
		inputs: grouped.get(snapshot.id) ?? [],
	}));
}
