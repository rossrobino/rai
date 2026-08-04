import { LineChart } from "echarts/charts";
import {
	GridComponent,
	LegendComponent,
	TooltipComponent,
} from "echarts/components";
import { init, use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

use([
	LineChart,
	GridComponent,
	LegendComponent,
	TooltipComponent,
	CanvasRenderer,
]);

type Point = {
	observedAt: string;
	value: number;
	inputs: {
		methodId: string;
		label: string;
		value: number;
	}[];
};

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

function format(value: number) {
	return money.format(value * 1_000_000);
}

function resolve(element: HTMLElement, token: string) {
	const color = element.style.color;
	element.style.color = `var(${token})`;
	const value = getComputedStyle(element).color;
	element.style.color = color;
	return value;
}

export function render(element: HTMLElement) {
	const source = element.parentElement?.querySelector<HTMLScriptElement>(
		'script[type="application/json"]',
	);
	if (!source?.textContent) return;

	const points: Point[] = JSON.parse(source.textContent);
	const methods = new Map(
		points.flatMap((point) =>
			point.inputs.map((input) => [input.methodId, input.label] as const),
		),
	);
	const styles = [
		{ token: "--series-1", type: "dashed", symbol: "diamond" },
		{ token: "--series-2", type: "dotted", symbol: "rect" },
		{ token: "--series-3", type: [10, 4, 2, 4], symbol: "triangle" },
		{ token: "--series-4", type: [4, 3], symbol: "roundRect" },
	];
	element.replaceChildren();
	const chart = init(element, undefined, { renderer: "canvas" });
	chart.setOption({
		animation: !matchMedia("(prefers-reduced-motion: reduce)").matches,
		animationDuration: 260,
		animationEasing: "cubicInOut",
		color: [
			resolve(element, "--accent"),
			...styles.map(({ token }) => resolve(element, token)),
		],
		grid: {
			containLabel: true,
			left: 8,
			right: 12,
			top: methods.size > 0 ? 64 : 24,
			bottom: 8,
		},
		legend: {
			show: methods.size > 0,
			top: 8,
			textStyle: { color: resolve(element, "--muted") },
		},
		tooltip: {
			trigger: "axis",
			valueFormatter: (value: unknown) => format(Number(value)),
		},
		xAxis: {
			type: "time",
			minInterval: 86_400_000,
			axisLabel: {
				color: resolve(element, "--muted"),
				formatter: (value: number) => date.format(new Date(value)),
			},
			axisLine: {
				lineStyle: { color: resolve(element, "--line") },
			},
		},
		yAxis: {
			type: "value",
			scale: true,
			axisLabel: {
				color: resolve(element, "--muted"),
				formatter: (value: number) => format(value),
			},
			splitLine: {
				lineStyle: { color: resolve(element, "--line") },
			},
		},
		series: [
			{
				name: "Rai current valuation",
				type: "line",
				data: points.map((point) => [point.observedAt, point.value]),
				emphasis: { disabled: true },
				lineStyle: { width: 3.5 },
				symbol: "circle",
				symbolSize: 8,
				showSymbol: points.length < 32,
			},
			...[...methods].map(([methodId, label], i) => ({
				name: label,
				type: "line",
				connectNulls: false,
				data: points.map((point) => [
					point.observedAt,
					point.inputs.find((input) => input.methodId === methodId)?.value ??
						null,
				]),
				emphasis: { disabled: true },
				lineStyle: {
					type: styles[i % styles.length]?.type,
					width: 2.25,
				},
				symbol: styles[i % styles.length]?.symbol,
				symbolSize: 6,
				showSymbol: points.length < 32,
			})),
		],
	});
	new ResizeObserver(() => chart.resize()).observe(element);
}
