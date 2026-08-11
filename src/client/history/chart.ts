import { EffectScatterChart, LineChart } from "echarts/charts";
import {
	GridComponent,
	LegendComponent,
	TooltipComponent,
} from "echarts/components";
import { init, use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

use([
	EffectScatterChart,
	LineChart,
	GridComponent,
	LegendComponent,
	TooltipComponent,
	CanvasRenderer,
]);

type Point = {
	observedAt: string;
	value: number;
	benchmark: number | null;
	inputs: {
		methodId: string;
		label: string;
		value: number;
	}[];
};

type View = "valuation" | "performance";
type Range = "week" | "max";

const day = 86_400_000;
const money = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	notation: "compact",
	maximumFractionDigits: 2,
});
const date = new Intl.DateTimeFormat("en-US", {
	timeZone: "America/New_York",
	month: "short",
	day: "numeric",
	year: "2-digit",
});
const shortDate = new Intl.DateTimeFormat("en-US", {
	timeZone: "America/New_York",
	month: "short",
	day: "numeric",
});

function format(value: number) {
	return money.format(value * 1_000_000);
}

function indexed(value: number) {
	const change = value - 100;
	return `${value.toFixed(2)} · ${change > 0 ? "+" : ""}${change.toFixed(2)}%`;
}

function normalize(values: [string, number | null][]) {
	const start = values.find(
		([, value]) => value != null && Number.isFinite(value) && value > 0,
	)?.[1];
	return values.map(([observedAt, value]): readonly [string, number | null] => [
		observedAt,
		start == null || value == null ? null : (value / start) * 100,
	]);
}

function select(points: Point[], range: Range) {
	if (range === "max") return points;
	const latest = new Date(points.at(-1)?.observedAt ?? 0).getTime();
	return points.filter(
		(point) => new Date(point.observedAt).getTime() >= latest - 7 * day,
	);
}

function resolve(element: HTMLElement, token: string) {
	const color = element.style.color;
	element.style.color = `var(${token})`;
	const value = getComputedStyle(element).color;
	element.style.color = color;
	return value;
}

function toggle(buttons: NodeListOf<HTMLButtonElement>, value: string) {
	for (const button of buttons) {
		button.setAttribute(
			"aria-pressed",
			String(
				button.dataset.historyView === value ||
					button.dataset.historyRange === value,
			),
		);
	}
}

export function render(element: HTMLElement) {
	const panel = element.closest<HTMLElement>(".history-chart-panel");
	const source = panel?.querySelector<HTMLScriptElement>(
		'script[type="application/json"]',
	);
	if (!source?.textContent || !panel) return;

	const points: Point[] = JSON.parse(source.textContent);
	const company = element.dataset.historyCompany ?? "Company";
	const methods = new Map(
		points.flatMap((point) =>
			point.inputs.map((input) => [input.methodId, input.label] as const),
		),
	);
	const styles = [
		{ token: "--series-1", type: "dashed" },
		{ token: "--series-2", type: "dotted" },
		{ token: "--series-3", type: [10, 4, 2, 4] },
		{ token: "--series-4", type: [4, 3] },
	];
	const accent = resolve(element, "--accent");
	const peer = resolve(element, "--series-1");
	const muted = resolve(element, "--muted");
	const line = resolve(element, "--line");
	const views = panel.querySelectorAll<HTMLButtonElement>(
		"[data-history-view]",
	);
	const ranges = panel.querySelectorAll<HTMLButtonElement>(
		"[data-history-range]",
	);
	let view: View = "valuation";
	let range: Range = "max";
	let compact = element.clientWidth < 620;

	element.replaceChildren();
	const chart = init(element, undefined, { renderer: "canvas" });

	function update() {
		const visible = select(points, range);
		const performance = view === "performance";
		const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
		const rai = performance
			? normalize(visible.map((point) => [point.observedAt, point.value]))
			: visible.map((point) => [point.observedAt, point.value] as const);
		const current = rai.findLast(([, value]) => value != null);
		chart.setOption(
			{
				animation: !reduced,
				animationDuration: 260,
				animationEasing: "cubicInOut",
				stateAnimation: { duration: 120, easing: "cubicOut" },
				color: performance
					? [accent, peer]
					: [accent, ...styles.map(({ token }) => resolve(element, token))],
				grid: {
					containLabel: true,
					left: 8,
					right: 12,
					top: performance || methods.size > 0 ? 64 : 24,
					bottom: 8,
				},
				legend: {
					show: performance || methods.size > 0,
					top: 8,
					textStyle: { color: muted },
				},
				tooltip: {
					trigger: "axis",
					valueFormatter: (value: unknown) =>
						performance ? indexed(Number(value)) : format(Number(value)),
				},
				xAxis: {
					type: "time",
					minInterval: day,
					splitNumber: compact ? 3 : 6,
					axisLabel: {
						color: muted,
						formatter: (value: number) =>
							(compact ? shortDate : date).format(new Date(value)),
						hideOverlap: true,
					},
					axisLine: { lineStyle: { color: line } },
				},
				yAxis: {
					type: "value",
					scale: true,
					name: performance ? "Indexed to 100" : undefined,
					nameTextStyle: { color: muted },
					axisLabel: {
						color: muted,
						formatter: (value: number) =>
							performance ? value.toFixed(0) : format(value),
					},
					splitLine: { lineStyle: { color: line } },
				},
				series: [
					...(performance
						? [
								{
									name: "Rai estimate",
									type: "line",
									data: rai,
									emphasis: { disabled: true },
									lineStyle: { color: accent, width: 3.5 },
									showSymbol: false,
									z: 3,
								},
								{
									name: `Rai Index (ex ${company})`,
									type: "line",
									connectNulls: false,
									data: normalize(
										visible.map((point) => [point.observedAt, point.benchmark]),
									),
									emphasis: { disabled: true },
									lineStyle: { color: peer, type: "dashed", width: 2.25 },
									showSymbol: false,
									z: 2,
								},
							]
						: [
								{
									name: "Rai current valuation",
									type: "line",
									data: rai,
									emphasis: { disabled: true },
									lineStyle: { width: 3.5 },
									showSymbol: false,
									z: 3,
								},
								...[...methods].map(([methodId, label], i) => {
									const style = styles[i % styles.length];
									if (!style) {
										throw new Error("Missing valuation chart series style");
									}
									const color = resolve(element, style.token);

									return {
										name: label,
										type: "line",
										connectNulls: false,
										data: visible.map((point) => [
											point.observedAt,
											point.inputs.find((input) => input.methodId === methodId)
												?.value ?? null,
										]),
										blur: {
											itemStyle: { color, opacity: 0.76 },
											lineStyle: { color, opacity: 0.76 },
										},
										emphasis: {
											focus: "none",
											scale: false,
											itemStyle: { color, opacity: 1 },
											lineStyle: { color, opacity: 1, width: 2.75 },
										},
										itemStyle: { color, opacity: 0.76 },
										lineStyle: {
											color,
											opacity: 0.76,
											type: style.type,
											width: 2,
										},
										showSymbol: false,
										z: 1,
									};
								}),
							]),
					{
						type: "effectScatter",
						clip: false,
						data: current ? [current] : [],
						itemStyle: { color: accent },
						rippleEffect: {
							brushType: "stroke",
							number: 1,
							period: 6,
							scale: 1.8,
						},
						showEffectOn: reduced ? "emphasis" : "render",
						silent: true,
						symbolSize: 8,
						tooltip: { show: false },
						z: 4,
					},
				],
			},
			true,
		);
		element.setAttribute(
			"aria-label",
			performance
				? `${company} Rai estimate compared with the leave-one-out Rai Index, normalized to 100 across ${visible.length} daily observations.`
				: `${company} valuation and method inputs across ${visible.length} daily observations.`,
		);
	}

	for (const button of views) {
		button.addEventListener("click", () => {
			const next = button.dataset.historyView;
			if (next !== "valuation" && next !== "performance") return;
			view = next;
			toggle(views, view);
			update();
		});
	}
	for (const button of ranges) {
		button.addEventListener("click", () => {
			const next = button.dataset.historyRange;
			if (next !== "week" && next !== "max") return;
			range = next;
			toggle(ranges, range);
			update();
		});
	}

	update();
	new ResizeObserver(() => {
		chart.resize();
		const next = element.clientWidth < 620;
		if (next === compact) return;
		compact = next;
		update();
	}).observe(element);
}
