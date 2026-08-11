import * as analyticsScript from "client:script/analytics";
import * as style from "client:style";
import { Render, type JSX } from "ovr";
import mark from "@/assets/rai-mark.svg?no-inline";
import og from "@/assets/rai-og.png?no-inline";
import {
	formatDate,
	formatMoney,
	formatProbability,
	type calculate,
	type Assumptions,
} from "@/server/model";

type Result = ReturnType<typeof calculate>;

export function Layout(props: {
	title: string;
	description?: string;
	navigation: JSX.Element;
	head?: JSX.Element;
	children?: JSX.Element;
}) {
	const title = `${props.title} · Rai`;
	const description =
		props.description ??
		"Rai estimates private-company valuations from prediction-market data.";
	const image = new URL(og, "https://rai.robino.dev").href;

	return (
		<html lang="en">
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<meta name="application-name" content="Rai" />
				<meta name="apple-mobile-web-app-title" content="Rai" />
				<meta
					name="theme-color"
					content="#efede8"
					media="(prefers-color-scheme: light)"
				/>
				<meta
					name="theme-color"
					content="#171613"
					media="(prefers-color-scheme: dark)"
				/>
				<meta name="description" content={description} />
				<meta property="og:type" content="website" />
				<meta property="og:site_name" content="Rai" />
				<meta property="og:locale" content="en_US" />
				<meta property="og:title" content={title} />
				<meta property="og:description" content={description} />
				<meta property="og:image" content={image} />
				<meta property="og:image:type" content="image/png" />
				<meta property="og:image:width" content="1200" />
				<meta property="og:image:height" content="630" />
				<meta
					property="og:image:alt"
					content="Rai — private-company valuations from prediction-market data"
				/>
				<meta name="twitter:card" content="summary_large_image" />
				<meta name="twitter:title" content={title} />
				<meta name="twitter:description" content={description} />
				<meta name="twitter:image" content={image} />
				<meta
					name="twitter:image:alt"
					content="Rai — private-company valuations from prediction-market data"
				/>
				<link rel="icon" href={mark} type="image/svg+xml" />
				{Render.html(style.tags)}
				{Render.html(analyticsScript.tags)}
				{props.head}
				<script type="speculationrules">
					{Render.html(
						JSON.stringify({
							prefetch: [
								{
									where: {
										and: [
											{ href_matches: "/*" },
											{
												not: {
													selector_matches:
														'a[href^="#"], [target="_blank"], [download], [rel~="nofollow"]',
												},
											},
										],
									},
									eagerness: "moderate",
								},
							],
						}),
					)}
				</script>
				<title>{title}</title>
			</head>
			<body>
				<a class="skip-link" href="#content">
					Skip to content
				</a>
				<header class="site-header">{props.navigation}</header>
				{props.children}
				<footer>
					<p>
						Rai is independent private-company valuation research using public
						prediction-market data.
					</p>
					<p>Not investment advice.</p>
				</footer>
			</body>
		</html>
	);
}

export function BrandMark() {
	return <img src={mark} alt="" width="32" height="32" />;
}

export function Eyebrow(props: { children?: JSX.Element }) {
	return <p class="eyebrow">{props.children}</p>;
}

/** Keeps contextual qualifications attached to the value they describe. */
export function Caveat(props: {
	label: string;
	warning?: boolean;
	children?: JSX.Element;
}) {
	return (
		<details class={props.warning ? "data-caveat warning" : "data-caveat"}>
			<summary title={props.label} aria-label={props.label}>
				*
			</summary>
			<div>{props.children}</div>
		</details>
	);
}

export function Metric(props: {
	label: string;
	value: string;
	note?: string;
	accent?: boolean;
}) {
	return (
		<div class={props.accent ? "metric metric-accent" : "metric"}>
			<p>{props.label}</p>
			<strong>{props.value}</strong>
			{props.note ? <small>{props.note}</small> : null}
		</div>
	);
}

export function Distribution(props: { result: Result; compact?: boolean }) {
	return (
		<div class="distribution">
			{props.result.outcomes.map((outcome) => (
				<div
					class={
						outcome.kind === "no_ipo"
							? "distribution-row distribution-row-muted"
							: "distribution-row"
					}
				>
					<div class="distribution-label">
						<strong>{outcome.label}</strong>
						<span>{formatProbability(outcome.normalizedProbability)}</span>
					</div>
					<div class="track" aria-hidden="true">
						<span
							style={`inline-size:${Math.max(outcome.normalizedProbability * 100, 0.35)}%`}
						/>
					</div>
					{props.compact ? null : (
						<div class="distribution-detail">
							<span>Raw {formatProbability(outcome.rawProbability)}</span>
							<span>
								{outcome.representativeValue == null
									? "Current scenario value"
									: `${formatMoney(outcome.representativeValue)} assigned`}
							</span>
							<span>
								{outcome.kind === "no_ipo"
									? "Mixed after IPO discounting"
									: `${formatMoney(outcome.contribution)} conditional contribution`}
							</span>
						</div>
					)}
				</div>
			))}
		</div>
	);
}

export function AuditTable(props: { result: Result }) {
	return (
		<>
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>Outcome</th>
							<th>Raw</th>
							<th>Normalized</th>
							<th>Assigned value</th>
							<th>Contribution</th>
						</tr>
					</thead>
					<tbody>
						{props.result.outcomes.map((outcome) => (
							<tr>
								<th>{outcome.label}</th>
								<td>{formatProbability(outcome.rawProbability)}</td>
								<td>{formatProbability(outcome.normalizedProbability)}</td>
								<td>
									{outcome.representativeValue == null
										? "N/A"
										: formatMoney(outcome.representativeValue)}
								</td>
								<td>
									{outcome.kind === "no_ipo"
										? "—"
										: formatMoney(outcome.contribution)}
								</td>
							</tr>
						))}
					</tbody>
					<tfoot>
						<tr>
							<th>Probability total</th>
							<td>{formatProbability(props.result.rawProbabilitySum)}</td>
							<td>{formatProbability(1)}</td>
							<td>—</td>
							<td>—</td>
						</tr>
					</tfoot>
				</table>
			</div>
			<details class="audit-disclosure">
				<summary>Why Rai normalizes the raw total</summary>
				<p>
					These independently traded market prices add up to{" "}
					{formatProbability(props.result.rawProbabilitySum)}, rather than 100%.
					Rai scales each probability proportionally so the outcomes form a
					complete distribution.
				</p>
				<p>
					This gap is not a Polymarket fee. It can reflect bid–ask spreads,
					uneven liquidity, or prices recorded at different times. When the gap
					is relatively large, normalization can meaningfully affect the
					estimate.
				</p>
			</details>
		</>
	);
}

export function AssumptionList(props: { assumptions: Assumptions }) {
	return (
		<dl class="assumption-list">
			<div>
				<dt>Annual discount rate</dt>
				<dd>{formatProbability(props.assumptions.discountRate)}</dd>
			</div>
			<div>
				<dt>Expected valuation date</dt>
				<dd>{formatDate(props.assumptions.expectedDate)}</dd>
			</div>
			<div>
				<dt>Lower open bracket</dt>
				<dd>{formatMoney(props.assumptions.lowerValue)}</dd>
			</div>
			<div>
				<dt>Upper open bracket</dt>
				<dd>{formatMoney(props.assumptions.upperValue)}</dd>
			</div>
			<div>
				<dt>Current no-IPO scenario value</dt>
				<dd>{formatMoney(props.assumptions.noIpoCurrentValue)}</dd>
			</div>
			<div>
				<dt>Probability method</dt>
				<dd>Bid–ask midpoint, then last trade</dd>
			</div>
		</dl>
	);
}
