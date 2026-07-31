import { Render, Route, type JSX } from "ovr";
import polymarket from "@/assets/polymarket-icon.svg?no-inline";
import {
	companies,
	getCompany,
	getCompanyMethod,
	type Company,
	type CompanyMethod,
} from "@/server/companies";
import type {
	PredictionIpoMethod,
	PredictionThresholdMethod,
} from "@/server/company-schema";
import {
	calculate,
	calculateThresholds,
	combineValuations,
	formatDate,
	formatDateTime,
	formatMoney,
	formatProbability,
} from "@/server/model";
import { getMethod, methods } from "@/server/methods";
import {
	fetchCompanyMarkets,
	fetchThresholdMarkets,
} from "@/server/polymarket";
import { getMethodProviders, getProvider } from "@/server/providers";
import {
	AssumptionList,
	AuditTable,
	BrandMark,
	Distribution,
	Eyebrow,
	Layout,
	Metric,
} from "@/server/ui";

const ensemble = "current-valuation-ensemble";

function Navigation() {
	return (
		<>
			<home.Anchor class="brand">
				<BrandMark />
				Rai
			</home.Anchor>
			<nav aria-label="Primary navigation">
				<dashboard.Anchor>Dashboard</dashboard.Anchor>
				<methodologies.Anchor>Methodology</methodologies.Anchor>
			</nav>
		</>
	);
}

function Page(props: {
	title: string;
	description?: string;
	children?: JSX.Element;
}) {
	return <Layout {...props} navigation={<Navigation />} />;
}

function plural(count: number, singular: string, multiple = `${singular}s`) {
	return count === 1 ? singular : multiple;
}

function board() {
	return companies.map((config) => ({
		config,
		load: resolveBoard(config, false),
	}));
}

export const home = Route.get("/", () => (
	<Page
		title="Private-company valuations from market data"
		description="Current private-company valuation estimates derived from public prediction-market probabilities."
	>
		<HomePage />
	</Page>
));

function HomePage() {
	return (
		<main id="content">
			<section class="hero shell">
				<div class="hero-copy">
					<Eyebrow>
						Rai · private-market research · {companies.length}{" "}
						{plural(companies.length, "company", "companies")}
					</Eyebrow>
					<h1>
						The crowd’s view, <em>priced into a valuation.</em>
					</h1>
					<p class="lede">
						We convert public prediction-market probabilities into transparent,
						probability-weighted estimates.
					</p>
					<div class="hero-actions">
						<dashboard.Anchor class="button">
							Open the dashboard
						</dashboard.Anchor>
						<home.Anchor class="text-link" hash="method">
							See the method <span aria-hidden="true">↓</span>
						</home.Anchor>
					</div>
				</div>
				<LargestCompanyMarketCard board={board()} />
			</section>

			<section class="tape" aria-label="Model highlights">
				<div class="shell tape-inner">
					<span>LIVE SOURCES</span>
					<b>POLYMARKET</b>
					<span>·</span>
					<b>
						{companies.length}{" "}
						{plural(companies.length, "COMPANY", "COMPANIES")}
					</b>
					<span>·</span>
					<b>PUBLIC MARKET LINKS</b>
				</div>
			</section>

			<section class="shell section split" id="method">
				<div class="prose">
					<Eyebrow>Method overview</Eyebrow>
					<h2>From market probabilities to a valuation distribution</h2>
					<p>
						Each source contract provides a selected probability. The
						calculation normalizes mutually exclusive outcomes, assigns
						representative values, and, when required, adjusts future values to
						the calculation date.
					</p>
					<methodologies.Anchor class="text-link">
						Browse methodologies <span aria-hidden="true">→</span>
					</methodologies.Anchor>
				</div>
				<nav class="method-index" aria-label="Valuation methodologies">
					{methods.map((method, i) => (
						<methodology.Anchor params={{ method: method.name }}>
							<span>{String(i + 1).padStart(2, "0")}</span>
							<div>
								<strong>{method.content.frontmatter.title}</strong>
								<small>{method.content.frontmatter.description}</small>
							</div>
							<b aria-hidden="true">↗</b>
						</methodology.Anchor>
					))}
				</nav>
			</section>
		</main>
	);
}

async function LargestCompanyMarketCard(props: {
	board: ReturnType<typeof board>;
}) {
	const loaded = await Promise.all(
		props.board.map(async (entry) => ({
			...entry,
			result: await entry.load,
		})),
	);
	const preview = loaded.sort(
		(a, b) =>
			(b.result.value?.estimate.value ?? 0) -
			(a.result.value?.estimate.value ?? 0),
	)[0];
	if (!preview) return null;

	return (
		<div class="home-hero-card">
			<CompanyMarketCard config={preview.config} load={preview.load} />
		</div>
	);
}

export const dashboard = Route.get("/dashboard", () => (
	<Page
		title="Valuation dashboard"
		description="Polymarket-based company valuation signals, source status, and method coverage."
	>
		<DashboardPage />
	</Page>
));

function DashboardPage() {
	const assignments = companies.flatMap((config) => config.methods);
	const live = assignments.filter((method) => method.storage === "live").length;
	const families = new Set(assignments.map((method) => method.family)).size;
	const markets = board();

	return (
		<main id="content">
			<section class="shell dashboard-hero">
				<div class="prose">
					<Eyebrow>Valuation dashboard</Eyebrow>
					<h1>Company estimates</h1>
					<p>
						Derived current valuations calculated from configured public
						prediction-market methods.
					</p>
				</div>
				<dl class="dashboard-stats">
					<div>
						<dt>{plural(companies.length, "Company", "Companies")}</dt>
						<dd>{companies.length}</dd>
					</div>
					<div>
						<dt>
							{plural(
								assignments.length,
								"Method assignment",
								"Method assignments",
							)}
						</dt>
						<dd>{assignments.length}</dd>
					</div>
					<div>
						<dt>{plural(live, "Live assignment", "Live assignments")}</dt>
						<dd>{live}</dd>
					</div>
					<div>
						<dt>{plural(families, "Evidence family", "Evidence families")}</dt>
						<dd>{families}</dd>
					</div>
				</dl>
			</section>

			<section class="shell dashboard-board">
				<div class="section-heading">
					<div>
						<Eyebrow>Company coverage</Eyebrow>
						<h2>Current valuations</h2>
					</div>
					<p>
						Each headline combines current-equivalent method outputs using the
						configured weights. The input estimates and their range remain
						visible on every card.
					</p>
				</div>
				<div class="market-board">
					{markets.map(({ config, load }) => (
						<CompanyMarketCard config={config} load={load} />
					))}
				</div>
			</section>
		</main>
	);
}

type LoadedMethod =
	| {
			kind: "ipo";
			method: PredictionIpoMethod;
			current: ReturnType<typeof calculate>;
			assumptions: PredictionIpoMethod["assumptions"];
			fetchedAt?: string;
	  }
	| {
			kind: "threshold";
			method: PredictionThresholdMethod;
			current: ReturnType<typeof calculateThresholds>;
			assumptions: PredictionThresholdMethod["assumptions"];
			fetchedAt?: string;
	  };

function valuationValue(value: LoadedMethod) {
	return value.kind === "ipo"
		? value.current.presentImpliedValue
		: value.current.deadlinePeakCurrentEquivalent;
}

function methodTitle(method: CompanyMethod) {
	return getMethod(method.method)?.content.frontmatter.title ?? method.method;
}

function methodLabel(value: LoadedMethod) {
	if (value.kind === "threshold") return "Threshold curve";
	const year = value.assumptions.expectedDate.slice(0, 4);
	return value.method.id.includes("higher")
		? `${year} higher-strike IPO`
		: `${year} IPO ladder`;
}

function methodHeading(value: LoadedMethod) {
	if (value.kind === "threshold") return methodTitle(value.method);
	const year = value.assumptions.expectedDate.slice(0, 4);
	return `${methodTitle(value.method)} — ${year}${value.method.id.includes("higher") ? " higher-strike series" : ""}`;
}

function methodSummary(method: CompanyMethod) {
	switch (method.method) {
		case "prediction-market-ipo":
			return `${getProvider(method.data.provider)?.name ?? method.data.provider} · ${method.data.events.length} source ${method.data.events.length === 1 ? "event" : "events"} · ${method.data.outcomes.length} outcomes`;
		case "prediction-market-valuation-thresholds":
			return `${getProvider(method.data.provider)?.name ?? method.data.provider} · ${method.data.thresholds.length} thresholds · maximum NPM Price by ${formatDate(method.data.claim.deadline)}`;
	}
}

function methodWeights(loaded: LoadedMethod[]) {
	const families = new Map<string, { weight: number; methods: number }>();
	for (const value of loaded) {
		if (value.method.familyWeight === 0 || value.method.weight === 0) continue;
		const family = families.get(value.method.family);
		if (family) {
			family.methods += value.method.weight;
		} else {
			families.set(value.method.family, {
				weight: value.method.familyWeight,
				methods: value.method.weight,
			});
		}
	}
	const total = [...families.values()].reduce(
		(sum, family) => sum + family.weight,
		0,
	);

	return loaded.map((value) => {
		const family = families.get(value.method.family);
		return {
			value,
			weight:
				family && total > 0
					? (family.weight / total) * (value.method.weight / family.methods)
					: 0,
		};
	});
}

function formatDifference(value: number, total: number) {
	const difference = total === 0 ? 0 : value / total - 1;
	return `${difference > 0 ? "+" : ""}${formatProbability(difference)}`;
}

async function loadMethod(
	_config: Company,
	method: CompanyMethod,
	participants = true,
): Promise<LoadedMethod> {
	if (method.method === "prediction-market-valuation-thresholds") {
		const thresholds = await fetchThresholdMarkets(method, participants);
		const current = calculateThresholds(thresholds, method.assumptions);
		return {
			kind: "threshold",
			method,
			current,
			assumptions: method.assumptions,
			fetchedAt: thresholds[0]?.fetchedAt,
		};
	}

	const outcomes = await fetchCompanyMarkets(method);
	const current = calculate(outcomes, method.assumptions);
	return {
		kind: "ipo",
		method,
		current,
		assumptions: method.assumptions,
		fetchedAt: outcomes[0]?.fetchedAt,
	};
}

function companyLoader(config: Company, participants = true) {
	const cache = new Map<string, Promise<LoadedMethod>>();
	const load = (method: CompanyMethod) => {
		const found = cache.get(method.id);
		if (found) return found;
		const request = Promise.resolve().then(() =>
			loadMethod(config, method, participants),
		);
		cache.set(method.id, request);
		return request;
	};
	return load;
}

export const company = Route.get("/companies/:name", (c) => {
	const config = getCompany(c.params.name);
	if (!config) {
		c.res.status = 404;
		return (
			<Page title="Company not found">
				<main id="content" class="shell empty-state">
					<Eyebrow>404 · Companies</Eyebrow>
					<h1>This company does not have a configured market ladder.</h1>
					<dashboard.Anchor class="button">
						View supported companies
					</dashboard.Anchor>
				</main>
			</Page>
		);
	}

	const view = c.url.searchParams.get("view");
	if (view) {
		c.res.status = 404;
		return (
			<Page title="View not found">
				<main id="content" class="shell empty-state">
					<Eyebrow>404 · {config.name}</Eyebrow>
					<h1>This company view does not exist.</h1>
					<company.Anchor class="button" params={{ name: config.slug }}>
						View company methods
					</company.Anchor>
				</main>
			</Page>
		);
	}

	const requested = c.url.searchParams.get("method");
	if (requested) {
		const selected = getCompanyMethod(config, requested);
		if (!selected) {
			c.res.status = 404;
			return (
				<Page title="Method not found">
					<main id="content" class="shell empty-state">
						<Eyebrow>404 · {config.name}</Eyebrow>
						<h1>This method is not assigned to the company.</h1>
						<company.Anchor class="button" params={{ name: config.slug }}>
							View company methods
						</company.Anchor>
					</main>
				</Page>
			);
		}
		return c.redirect(`/companies/${config.slug}#${selected.id}`, 302);
	}

	const load = resolveBoard(config);
	return (
		<Page title={`${config.name} valuation`} description={config.description}>
			<main id="content">
				<section class="company-hero shell">
					<div>
						<Eyebrow>{config.sector}</Eyebrow>
						<h1>{config.name}</h1>
						<p>{config.description}</p>
					</div>
				</section>
				<CompanyValuationSummary config={config} load={load} />
				<CompanyMethods config={config} load={load} />
			</main>
		</Page>
	);
});

export const observation = Route.get(
	"/api/companies/:name/methods/:method",
	async (c) => {
		const config = getCompany(c.params.name);
		const method = config
			? getCompanyMethod(config, c.params.method)
			: undefined;
		if (!config || !method) {
			c.res.status = 404;
			return c.json({ error: "Company method not found." });
		}

		try {
			const loaded = await loadMethod(config, method);
			return c.json({
				schemaVersion: 1,
				company: {
					id: config.id,
					slug: config.slug,
					name: config.name,
				},
				method,
				observation: {
					fetchedAt: loaded.fetchedAt,
					calculation: loaded.current,
				},
			});
		} catch (error) {
			c.res.status = 502;
			return c.json({
				error:
					error instanceof Error
						? error.message
						: "The market source was unavailable.",
			});
		}
	},
);

async function loadBoard(config: Company, participants = true) {
	const load = companyLoader(config, participants);
	const results = await Promise.all(
		config.methods.map(async (method) => {
			try {
				return await load(method);
			} catch {
				return null;
			}
		}),
	);
	const loaded = results.filter(
		(value): value is LoadedMethod => value != null,
	);
	if (loaded.length === 0) {
		throw new Error("No assigned valuation method is currently available.");
	}

	return {
		loaded,
		failed: config.methods.length - loaded.length,
		estimate: combineValuations(
			loaded.map((value) => ({
				family: value.method.family,
				familyWeight: value.method.familyWeight,
				value: valuationValue(value),
				weight: value.method.weight,
			})),
		),
		fetchedAt: loaded
			.map((value) => value.fetchedAt)
			.filter((value) => value != null)
			.sort()[0],
	};
}

async function resolveBoard(config: Company, participants = true) {
	try {
		return { value: await loadBoard(config, participants), error: null };
	} catch (error) {
		return { value: null, error };
	}
}

function sourceMode(config: Company) {
	const live = config.methods.filter(
		(method) => method.storage === "live",
	).length;
	if (live === config.methods.length) {
		return { label: "Market live", class: "live" };
	}
	if (live === 0) {
		return { label: "Dated sources", class: "dated" };
	}
	return { label: "Mixed sources", class: "mixed" };
}

function companyTransition(config: Company) {
	return `rai-company-${config.slug}`;
}

function valuationTransition(config: Company) {
	return `${companyTransition(config)}-valuation`;
}

function CompanyMarketCard(props: {
	config: Company;
	load: ReturnType<typeof resolveBoard>;
}) {
	const { config, load } = props;
	const mode = sourceMode(config);

	return (
		<company.Anchor
			class="valuation-card market-card"
			params={{ name: config.slug }}
			style={`view-transition-name:${companyTransition(config)}`}
		>
			<div class="valuation-card-top">
				<span class={`status ${mode.class}`}>
					<i aria-hidden="true" /> {mode.label}
				</span>
				<span>{config.code}</span>
			</div>
			<CompanyMarketValue config={config} load={load} />
		</company.Anchor>
	);
}

async function CompanyMarketValue(props: {
	config: Company;
	load: ReturnType<typeof resolveBoard>;
}) {
	const result = await props.load;
	if (!result.value) {
		return (
			<div class="market-card-value unavailable">
				<p>Valuation signals</p>
				<strong>—</strong>
				<span>Market sources are temporarily unavailable.</span>
				<small>
					Open {props.config.name} to inspect its configured methods.
				</small>
			</div>
		);
	}

	const { estimate, failed, fetchedAt, loaded } = result.value;
	return (
		<div class="market-card-value">
			<p>
				<span>Rai current valuation</span>
				<small>
					{failed > 0
						? "Partial estimate"
						: loaded.length === 1
							? "Single method"
							: "Weighted estimate"}
				</small>
			</p>
			<div class="valuation-card-estimate">
				<strong
					style={`view-transition-name:${valuationTransition(props.config)}`}
				>
					{formatMoney(estimate.value, true)}
				</strong>
				<small>
					{estimate.methods} current-equivalent{" "}
					{estimate.methods === 1 ? "input" : "inputs"}
				</small>
				{estimate.methods > 1 ? (
					<div>
						<span>Input range</span>
						<b>
							{formatMoney(estimate.low, true)}–
							{formatMoney(estimate.high, true)}
						</b>
					</div>
				) : null}
			</div>
			<div class="valuation-card-signals">
				{loaded.map((value) => (
					<div class="valuation-card-signal">
						<span>{methodLabel(value)}</span>
						<b>{formatMoney(valuationValue(value), true)}</b>
					</div>
				))}
			</div>
			<div class="market-card-meta">
				<small>
					{fetchedAt
						? `Fetched ${formatDateTime(fetchedAt)}`
						: "Fetch time unavailable"}
					{failed > 0
						? ` · ${failed} ${failed === 1 ? "method" : "methods"} unavailable`
						: ""}
				</small>
				<b aria-hidden="true">↗</b>
			</div>
		</div>
	);
}

function CompanyValuationSummary(props: {
	config: Company;
	load: ReturnType<typeof resolveBoard>;
}) {
	return (
		<section
			class="shell company-valuation"
			aria-label={`${props.config.name} current valuation`}
			style={`view-transition-name:${companyTransition(props.config)}`}
		>
			<CompanyValuationValue {...props} />
		</section>
	);
}

async function CompanyValuationValue(props: {
	config: Company;
	load: ReturnType<typeof resolveBoard>;
}) {
	const result = await props.load;
	if (!result.value) {
		return (
			<p class="company-valuation-unavailable">
				The current valuation is temporarily unavailable. The configured methods
				remain available for inspection.
			</p>
		);
	}

	const { estimate, failed, fetchedAt, loaded } = result.value;
	const rows = methodWeights(loaded);
	const maximum = Math.max(
		estimate.value,
		...rows.map(({ value }) => valuationValue(value)),
	);

	return (
		<>
			<div>
				<Eyebrow>Rai current valuation</Eyebrow>
				<strong
					style={`view-transition-name:${valuationTransition(props.config)}`}
				>
					{formatMoney(estimate.value, true)}
				</strong>
				<p>
					A weighted estimate derived from {estimate.methods} current-equivalent{" "}
					{estimate.methods === 1 ? "method" : "methods"}. The comparison shows
					the value and effective ensemble weight of each input.
				</p>
			</div>
			<dl>
				<div>
					<dt>Input range</dt>
					<dd>
						{formatMoney(estimate.low, true)}–{formatMoney(estimate.high, true)}
					</dd>
				</div>
				<div>
					<dt>Weighting</dt>
					<dd>
						{estimate.families.length === 1 &&
						new Set(loaded.map((value) => value.method.weight)).size === 1
							? "Equal within family"
							: "Configured hierarchy"}
					</dd>
				</div>
				<div>
					<dt>Input spread</dt>
					<dd>{formatProbability(estimate.spreadRatio)}</dd>
				</div>
				<div>
					<dt>Fetched</dt>
					<dd>{fetchedAt ? formatDateTime(fetchedAt) : "Unavailable"}</dd>
				</div>
			</dl>
			<div class="valuation-comparison">
				<header>
					<div>
						<Eyebrow>Estimate composition</Eyebrow>
						<h2>Total and method inputs</h2>
					</div>
					<p>
						Bars share a zero baseline. Differences are measured against the Rai
						estimate.
					</p>
				</header>
				<ol>
					<li class="total">
						<div>
							<strong>Rai combined</strong>
							<span>Weighted current valuation</span>
						</div>
						<div class="valuation-comparison-track" aria-hidden="true">
							<span
								style={`inline-size:${maximum === 0 ? 0 : (estimate.value / maximum) * 100}%`}
							/>
						</div>
						<small>100% result</small>
						<b>{formatMoney(estimate.value, true)}</b>
					</li>
					{rows.map(({ value, weight }) => (
						<li>
							<div>
								<strong>{methodLabel(value)}</strong>
								<span>
									{formatDifference(valuationValue(value), estimate.value)}
								</span>
							</div>
							<div class="valuation-comparison-track" aria-hidden="true">
								<span
									style={`inline-size:${maximum === 0 ? 0 : (valuationValue(value) / maximum) * 100}%`}
								/>
							</div>
							<small>{formatProbability(weight)} weight</small>
							<b>{formatMoney(valuationValue(value), true)}</b>
						</li>
					))}
				</ol>
				{failed > 0 ? (
					<p class="valuation-comparison-note">
						{failed} configured {failed === 1 ? "method is" : "methods are"}{" "}
						currently unavailable and excluded from the estimate.
					</p>
				) : null}
			</div>
		</>
	);
}

async function CompanyMethods(props: {
	config: Company;
	load: ReturnType<typeof resolveBoard>;
}) {
	const result = await props.load;
	if (!result.value) {
		return null;
	}
	const { estimate, failed, loaded } = result.value;
	const weights = methodWeights(loaded);

	return (
		<>
			<section class="shell company-methods-intro" id="methods">
				<div class="section-heading">
					<div>
						<Eyebrow>Method inputs</Eyebrow>
						<h2>Calculations included in the estimate</h2>
					</div>
					<p>
						Each method is shown in full below. Its output is translated to a
						current-equivalent valuation before entering the combined estimate.
					</p>
				</div>
				<nav aria-label={`${props.config.name} valuation methods`}>
					{weights.map(({ value, weight }, i) => (
						<company.Anchor
							params={{ name: props.config.slug }}
							hash={value.method.id}
						>
							<span>{String(i + 1).padStart(2, "0")}</span>
							<div>
								<strong>{methodHeading(value)}</strong>
								<small>
									{formatMoney(valuationValue(value), true)} ·{" "}
									{formatProbability(weight)} ensemble weight
								</small>
							</div>
							<b aria-hidden="true">↓</b>
						</company.Anchor>
					))}
				</nav>
				{failed > 0 ? (
					<div class="alert warning">
						{failed} configured {failed === 1 ? "method is" : "methods are"} not
						available in this response.
					</div>
				) : null}
			</section>
			{weights.map(({ value, weight }, i) => (
				<article class="company-method" id={value.method.id}>
					<header class="shell company-method-header">
						<div class="prose">
							<Eyebrow>
								Method {String(i + 1).padStart(2, "0")} ·{" "}
								{value.method.family.replaceAll("-", " ")}
							</Eyebrow>
							<h2>{methodHeading(value)}</h2>
							<p>{methodSummary(value.method)}</p>
							<nav aria-label={`${methodHeading(value)} resources`}>
								<methodology.Anchor params={{ method: value.method.method }}>
									Read methodology <span aria-hidden="true">↗</span>
								</methodology.Anchor>
								<observation.Anchor
									params={{
										name: props.config.slug,
										method: value.method.id,
									}}
									target="_blank"
								>
									Export current JSON <span aria-hidden="true">↗</span>
								</observation.Anchor>
							</nav>
						</div>
						<div class="company-method-value">
							<span>Current-equivalent input</span>
							<strong>{formatMoney(valuationValue(value), true)}</strong>
							<dl>
								<div>
									<dt>Difference from total</dt>
									<dd>
										{formatDifference(valuationValue(value), estimate.value)}
									</dd>
								</div>
								<div>
									<dt>Ensemble weight</dt>
									<dd>{formatProbability(weight)}</dd>
								</div>
								<div>
									<dt>Fetched</dt>
									<dd>
										{value.fetchedAt
											? formatDateTime(value.fetchedAt)
											: "Unavailable"}
									</dd>
								</div>
							</dl>
						</div>
					</header>
					{value.kind === "threshold" ? (
						<ThresholdAnalysis config={props.config} value={value} />
					) : (
						<IpoAnalysis config={props.config} value={value} />
					)}
				</article>
			))}
		</>
	);
}

function IpoAnalysis(props: {
	config: Company;
	value: Extract<LoadedMethod, { kind: "ipo" }>;
}) {
	const { config, value } = props;
	const { current, assumptions } = value;

	const lowPresent = calculate(current.outcomes, {
		...assumptions,
		discountRate: assumptions.uncertainty.discountRateLow,
	}).presentImpliedValue;
	const highPresent = calculate(current.outcomes, {
		...assumptions,
		discountRate: assumptions.uncertainty.discountRateHigh,
	}).presentImpliedValue;
	const lowPrivate = calculate(current.outcomes, {
		...assumptions,
		noIpoCurrentValue: assumptions.uncertainty.noIpoValueLow,
	}).presentImpliedValue;
	const highPrivate = calculate(current.outcomes, {
		...assumptions,
		noIpoCurrentValue: assumptions.uncertainty.noIpoValueHigh,
	}).presentImpliedValue;

	return (
		<>
			<section class="shell metric-grid">
				<Metric
					label={
						config.methods.length === 1
							? "Rai current valuation"
							: "IPO-cap current equivalent"
					}
					value={formatMoney(current.presentImpliedValue, true)}
					note={
						config.methods.length === 1
							? "Single-method estimate · IPO-cap current equivalent"
							: "Public market cap based on outstanding shares"
					}
					accent
				/>
				<Metric
					label="Conditional IPO valuation"
					value={formatMoney(current.conditionalIpoValue)}
					note="Assuming an IPO by the deadline"
				/>
				<Metric
					label="Discounted IPO scenario"
					value={formatMoney(current.discountedIpoValue)}
					note={`IPO branch discounted ${current.years.toFixed(2)} years`}
				/>
				<Metric
					label="Probability of IPO"
					value={formatProbability(current.ipoProbability)}
					note={`By ${formatDate(assumptions.expectedDate)}`}
				/>
			</section>

			{current.warnings.map((warning) => (
				<div class="shell alert warning">{warning}</div>
			))}

			<section class="shell section" id={`${value.method.id}-distribution`}>
				<div class="section-heading">
					<div>
						<Eyebrow>Probability distribution</Eyebrow>
						<h3>Normalized market probabilities</h3>
					</div>
					<p>
						Raw binary-market prices total{" "}
						<strong>{formatProbability(current.rawProbabilitySum)}</strong>.
						They are normalized to a complete distribution before valuation.
					</p>
				</div>
				<Distribution result={current} />
				<details>
					<summary>Open audit table</summary>
					<AuditTable result={current} />
				</details>
			</section>

			<section class="dark-section" id={`${value.method.id}-calculation`}>
				<div class="shell">
					<div class="section-heading">
						<div>
							<Eyebrow>Calculation details</Eyebrow>
							<h3>IPO-ladder calculation</h3>
						</div>
						<p>
							All monetary values are calculated internally in millions of US
							dollars.
						</p>
					</div>
					<ol class="formula-steps">
						<li>
							<span>01</span>
							<div>
								<h4>Normalize the ladder</h4>
								<p>
									Each raw probability ÷{" "}
									{formatProbability(current.rawProbabilitySum)}
								</p>
							</div>
							<strong>100.0%</strong>
						</li>
						<li>
							<span>02</span>
							<div>
								<h4>Weight IPO outcomes</h4>
								<p>Σ conditional probability × assigned bracket value</p>
							</div>
							<strong>{formatMoney(current.conditionalIpoValue)}</strong>
						</li>
						<li>
							<span>03</span>
							<div>
								<h4>Discount the future IPO branch</h4>
								<p>
									IPO scenario ÷ (1 +{" "}
									{formatProbability(assumptions.discountRate)})^
									{current.years.toFixed(2)}
								</p>
							</div>
							<strong>{formatMoney(current.discountedIpoValue)}</strong>
						</li>
						<li>
							<span>04</span>
							<div>
								<h4>Mix current-equivalent branches</h4>
								<p>
									IPO odds × discounted IPO cap + residual odds × current
									private scenario value of{" "}
									{formatMoney(assumptions.noIpoCurrentValue)}
								</p>
							</div>
							<strong>{formatMoney(current.presentImpliedValue)}</strong>
						</li>
					</ol>
				</div>
			</section>

			<section class="shell section split">
				<div class="prose">
					<Eyebrow>Assumptions</Eyebrow>
					<h3>Configured valuation assumptions</h3>
					<p>
						Closed brackets use arithmetic midpoints. Open brackets and the
						no-IPO scenario use configured values. The no-IPO value is already a
						current private-company scenario, so it is not discounted again.
					</p>
					<p>
						Assumptions as of {formatDate(assumptions.provenance.asOf)}:{" "}
						<a
							href={assumptions.provenance.sourceUrl}
							target="_blank"
							rel="noreferrer"
						>
							source and rationale <span aria-hidden="true">↗</span>
						</a>
						. {assumptions.provenance.rationale}
					</p>
				</div>
				<AssumptionList assumptions={assumptions} />
			</section>

			<section class="shell section">
				<div class="section-heading">
					<div>
						<Eyebrow>Sensitivity</Eyebrow>
						<h3>One-variable sensitivity analysis</h3>
					</div>
					<p>
						Each check varies one configured assumption from its base value.
					</p>
				</div>
				<div class="sensitivity-grid">
					<Metric
						label={`${formatProbability(assumptions.uncertainty.discountRateLow)} discount rate`}
						value={formatMoney(lowPresent)}
					/>
					<Metric
						label={`${formatProbability(assumptions.uncertainty.discountRateHigh)} discount rate`}
						value={formatMoney(highPresent)}
					/>
					<Metric
						label={`${formatMoney(assumptions.uncertainty.noIpoValueLow)} no-IPO scenario`}
						value={formatMoney(lowPrivate)}
					/>
					<Metric
						label={`${formatMoney(assumptions.uncertainty.noIpoValueHigh)} no-IPO scenario`}
						value={formatMoney(highPrivate)}
					/>
				</div>
			</section>

			<section class="shell section">
				<div class="section-heading">
					<div>
						<Eyebrow>Source markets</Eyebrow>
						<h3>Polymarket source quotes</h3>
					</div>
					<ProviderIdentity
						id="polymarket"
						note="Gamma API · tradable midpoint preferred"
					/>
				</div>
				<div class="source-list">
					{current.outcomes.map((outcome) => (
						<article>
							<div>
								<span class="badge">{outcome.selectedMethod}</span>
								<h4>{outcome.label}</h4>
								<p>{outcome.sourceQuestion}</p>
							</div>
							<dl>
								<div>
									<dt>Bid / ask</dt>
									<dd>
										{outcome.bid == null ? "—" : formatProbability(outcome.bid)}{" "}
										/{" "}
										{outcome.ask == null ? "—" : formatProbability(outcome.ask)}
									</dd>
								</div>
								<div>
									<dt>Volume</dt>
									<dd>
										{outcome.volume == null
											? "—"
											: `$${Math.round(outcome.volume).toLocaleString("en-US")}`}
									</dd>
								</div>
								<div>
									<dt>Provider / fetched</dt>
									<dd>
										{outcome.sourceUpdatedAt
											? formatDateTime(outcome.sourceUpdatedAt)
											: "—"}{" "}
										/ {formatDateTime(outcome.fetchedAt)}
									</dd>
								</div>
							</dl>
							<a href={outcome.sourceUrl} target="_blank" rel="noreferrer">
								View market <span aria-hidden="true">↗</span>
							</a>
						</article>
					))}
				</div>
			</section>

			<section class="shell disclosure prose">
				<Eyebrow>Important limitations</Eyebrow>
				<h3>Scope and limitations</h3>
				<p>
					Prediction prices may be illiquid, stale, or distorted. Open-ended
					brackets require judgment. First-day IPO market capitalization is not
					intrinsic value, and this model does not account for future dilution,
					capital raised, or operating fundamentals.
				</p>
				<p>
					This estimate is not an ownership interest in {config.name}, an offer
					to buy or sell securities, or investment advice.
				</p>
			</section>
		</>
	);
}

function ThresholdAnalysis(props: {
	config: Company;
	value: Extract<LoadedMethod, { kind: "threshold" }>;
}) {
	const { config, value } = props;
	const { current, assumptions } = value;
	const first = current.thresholds[0];
	const last = current.thresholds.at(-1);
	const lowFloor = calculateThresholds(current.thresholds, {
		...assumptions,
		floorValue: assumptions.uncertainty.floorValueLow,
	}).expectedPeakValue;
	const highFloor = calculateThresholds(current.thresholds, {
		...assumptions,
		floorValue: assumptions.uncertainty.floorValueHigh,
	}).expectedPeakValue;
	const lowTail = calculateThresholds(current.thresholds, {
		...assumptions,
		upperValue: assumptions.uncertainty.upperValueLow,
	}).expectedPeakValue;
	const highTail = calculateThresholds(current.thresholds, {
		...assumptions,
		upperValue: assumptions.uncertainty.upperValueHigh,
	}).expectedPeakValue;

	return (
		<>
			<section class="shell metric-grid">
				<Metric
					label="Deadline-peak current equivalent"
					value={formatMoney(current.deadlinePeakCurrentEquivalent, true)}
					note={`Threshold method’s input to the Rai current valuation · ${formatProbability(assumptions.growthRate)} annual bridge`}
					accent
				/>
				<Metric
					label="Expected maximum by deadline"
					value={formatMoney(current.expectedPeakValue)}
					note={`Maximum qualifying NPM Price through ${formatDate(assumptions.expectedDate)}`}
				/>
				<Metric
					label={
						first
							? `Chance of at least ${formatMoney(first.value)}`
							: "First threshold"
					}
					value={first ? formatProbability(first.adjustedProbability) : "—"}
					note="Fitted cumulative probability"
				/>
				<Metric
					label={
						last
							? `Chance of at least ${formatMoney(last.value)}`
							: "Top threshold"
					}
					value={last ? formatProbability(last.adjustedProbability) : "—"}
					note="Open upper-tail probability"
				/>
			</section>

			{current.warnings.map((warning) => (
				<div class="shell alert warning">{warning}</div>
			))}

			<section class="shell section" id={`${value.method.id}-distribution`}>
				<div class="section-heading">
					<div>
						<Eyebrow>Implied distribution</Eyebrow>
						<h3>Cumulative threshold distribution</h3>
					</div>
					<p>
						Each contract prices the chance that {config.name} reaches at least
						its threshold under the configured NPM Price definition. Adjacent
						fitted probabilities are differenced to avoid double-counting.{" "}
						<a
							href={value.method.data.claim.rulesUrl}
							target="_blank"
							rel="noreferrer"
						>
							Read the source rules <span aria-hidden="true">↗</span>
						</a>
						.
					</p>
				</div>
				<div class="distribution">
					{current.bands.map((band) => (
						<div class="distribution-row">
							<div class="distribution-label">
								<strong>{band.label}</strong>
								<span>{formatProbability(band.probability)}</span>
							</div>
							<div class="track" aria-hidden="true">
								<span
									style={`inline-size:${Math.max(band.probability * 100, 0.35)}%`}
								/>
							</div>
							<div class="distribution-detail">
								<span>{formatMoney(band.representativeValue)} assigned</span>
								<span>{formatMoney(band.contribution)} contribution</span>
							</div>
						</div>
					))}
				</div>
				<details>
					<summary>Open threshold audit table</summary>
					<div class="table-wrap">
						<table>
							<thead>
								<tr>
									<th>Threshold</th>
									<th>Source quote</th>
									<th>Fitted</th>
									<th>Wallets</th>
									<th>Provider updated</th>
								</tr>
							</thead>
							<tbody>
								{current.thresholds.map((threshold) => (
									<tr>
										<th>{threshold.label}</th>
										<td>{formatProbability(threshold.rawProbability)}</td>
										<td>{formatProbability(threshold.adjustedProbability)}</td>
										<td>
											{threshold.participants == null
												? "—"
												: threshold.participants.toLocaleString("en-US")}
										</td>
										<td>
											{threshold.sourceUpdatedAt
												? formatDateTime(threshold.sourceUpdatedAt)
												: "—"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</details>
			</section>

			<section class="dark-section" id={`${value.method.id}-calculation`}>
				<div class="shell">
					<div class="section-heading">
						<div>
							<Eyebrow>Calculation details</Eyebrow>
							<h3>Threshold-curve calculation</h3>
						</div>
						<p>
							The source distribution describes the highest valuation reached by
							the deadline. The current-equivalent figure is reported separately
							as an assumption-driven scenario.
						</p>
					</div>
					<ol class="formula-steps">
						<li>
							<span>01</span>
							<div>
								<h4>Select market quotes</h4>
								<p>
									Use one selected Polymarket quote for each configured NPM
									Price threshold
								</p>
							</div>
							<strong>{current.thresholds.length} contracts</strong>
						</li>
						<li>
							<span>02</span>
							<div>
								<h4>Fit a monotone curve</h4>
								<p>
									The chance of exceeding a higher value cannot exceed the
									chance of exceeding a lower one
								</p>
							</div>
							<strong>Equal-weight isotonic fit</strong>
						</li>
						<li>
							<span>03</span>
							<div>
								<h4>Difference adjacent thresholds</h4>
								<p>
									P(band) = P(above lower) − P(above upper), then weight each
									band
								</p>
							</div>
							<strong>{formatMoney(current.expectedPeakValue)}</strong>
						</li>
						<li>
							<span>04</span>
							<div>
								<h4>Translate the peak to current value</h4>
								<p>
									Peak value ÷ (1 + {formatProbability(assumptions.growthRate)}
									)^
									{current.years.toFixed(2)}
								</p>
							</div>
							<strong>
								{formatMoney(current.deadlinePeakCurrentEquivalent)}
							</strong>
						</li>
					</ol>
				</div>
			</section>

			<section class="shell section split">
				<div class="prose">
					<Eyebrow>Assumptions</Eyebrow>
					<h3>Lower- and upper-tail assumptions</h3>
					<p>
						The lowest band is anchored at a known valuation floor. Closed bands
						use midpoints, while the open upper tail needs an explicit
						representative value.
					</p>
					<p>
						Assumptions as of {formatDate(assumptions.provenance.asOf)}:{" "}
						<a
							href={assumptions.provenance.sourceUrl}
							target="_blank"
							rel="noreferrer"
						>
							source and rationale <span aria-hidden="true">↗</span>
						</a>
						. {assumptions.provenance.rationale}
					</p>
				</div>
				<dl class="assumption-list">
					<div>
						<dt>Expected annual growth to peak</dt>
						<dd>{formatProbability(assumptions.growthRate)}</dd>
					</div>
					<div>
						<dt>Market deadline</dt>
						<dd>{formatDate(assumptions.expectedDate)}</dd>
					</div>
					<div>
						<dt>Lower valuation floor</dt>
						<dd>{formatMoney(assumptions.floorValue)}</dd>
					</div>
					<div>
						<dt>Upper-tail representative</dt>
						<dd>{formatMoney(assumptions.upperValue)}</dd>
					</div>
					<div>
						<dt>Curve constraint</dt>
						<dd>Equal-weight non-increasing fit</dd>
					</div>
					<div>
						<dt>Probability method</dt>
						<dd>Single-source Polymarket curve</dd>
					</div>
				</dl>
			</section>

			<section class="shell section">
				<div class="section-heading">
					<div>
						<Eyebrow>Sensitivity</Eyebrow>
						<h3>Growth-rate and upper-tail sensitivity</h3>
					</div>
					<p>
						These checks vary the distribution’s open lower and upper tails. The
						current-equivalent bridge is an assumption-driven input to the Rai
						current valuation, not a direct market quote.
					</p>
				</div>
				<div class="sensitivity-grid">
					<Metric
						label={`${formatMoney(assumptions.uncertainty.floorValueLow)} lower floor`}
						value={formatMoney(lowFloor)}
					/>
					<Metric
						label={`${formatMoney(assumptions.uncertainty.floorValueHigh)} lower floor`}
						value={formatMoney(highFloor)}
					/>
					<Metric
						label={`${formatMoney(assumptions.uncertainty.upperValueLow)} upper tail`}
						value={formatMoney(lowTail)}
					/>
					<Metric
						label={`${formatMoney(assumptions.uncertainty.upperValueHigh)} upper tail`}
						value={formatMoney(highTail)}
					/>
				</div>
			</section>

			<section class="shell section">
				<div class="section-heading">
					<div>
						<Eyebrow>Source markets</Eyebrow>
						<h3>Polymarket threshold contracts</h3>
					</div>
					<ProviderIdentity
						id={value.method.data.provider}
						note="Gamma and Data APIs · wallet counts are diagnostic only"
					/>
				</div>
				<div class="source-list">
					{current.thresholds.map((threshold) => (
						<article>
							<div>
								<span class="badge">{threshold.selectedMethod}</span>
								<h4>{threshold.label}</h4>
								<p>{threshold.sourceQuestion}</p>
							</div>
							<dl>
								<div>
									<dt>Source / fitted</dt>
									<dd>
										{formatProbability(threshold.rawProbability)} /{" "}
										{formatProbability(threshold.adjustedProbability)}
									</dd>
								</div>
								<div>
									<dt>Wallets / volume</dt>
									<dd>
										{threshold.participants == null
											? "—"
											: threshold.participants.toLocaleString("en-US")}{" "}
										/{" "}
										{threshold.volume == null
											? "—"
											: `$${Math.round(threshold.volume).toLocaleString("en-US")}`}
									</dd>
								</div>
								<div>
									<dt>Provider / fetched</dt>
									<dd>
										{threshold.sourceUpdatedAt
											? formatDateTime(threshold.sourceUpdatedAt)
											: "—"}{" "}
										/ {formatDateTime(threshold.fetchedAt)}
									</dd>
								</div>
							</dl>
							<a href={threshold.sourceUrl} target="_blank" rel="noreferrer">
								View market <span aria-hidden="true">↗</span>
							</a>
						</article>
					))}
				</div>
			</section>

			<section class="shell disclosure prose">
				<Eyebrow>Important limitations</Eyebrow>
				<h3>Scope and limitations</h3>
				<p>
					The contracts resolve on the highest qualifying non-public-market or
					public-market valuation observed before the deadline. The estimate is
					path-dependent and should not be read as a terminal, intrinsic, or
					year-end or current value. Reported participants are trading wallets,
					not verified people, and do not affect the fit. Thin markets,
					correlated contract errors, the chosen floor, and the open upper tail
					can all affect the result.
				</p>
				<p>
					This estimate is not an ownership interest in {config.name}, an offer
					to buy or sell securities, or investment advice.
				</p>
			</section>
		</>
	);
}

function ProviderIdentity(props: { id: string; note: string }) {
	const provider = getProvider(props.id);
	if (!provider) return null;

	return (
		<div class="provider-identity">
			<a
				href={provider.website}
				target="_blank"
				rel="noreferrer"
				aria-label={`${provider.name} website`}
			>
				{provider.asset ? (
					<img src={polymarket} alt="" width="36" height="36" />
				) : null}
				<strong>{provider.name}</strong>
			</a>
			<small>
				{props.note} ·{" "}
				<a href={provider.docs} target="_blank" rel="noreferrer">
					API docs
				</a>{" "}
				·{" "}
				<a href={provider.terms} target="_blank" rel="noreferrer">
					terms
				</a>
			</small>
		</div>
	);
}

function MethodSources(props: { method: string }) {
	const sources = getMethodProviders(props.method);

	return (
		<section class="method-sources" id="data-sources">
			<Eyebrow>Data provenance</Eyebrow>
			<h2>Data sources and permissions</h2>
			<p>
				Provider names identify the origin of source data. Availability reflects
				the provider’s published terms for this use; it does not imply a
				partnership or endorsement.
			</p>
			<div class="provider-grid">
				{sources.map((provider) => (
					<article>
						<header>
							<div class="provider-name">
								{provider.asset ? (
									<img src={polymarket} alt="" width="44" height="44" />
								) : null}
								<h3>{provider.name}</h3>
							</div>
							<span class={`provider-status ${provider.status}`}>
								{provider.status === "active"
									? "Active source"
									: "Permission required"}
							</span>
						</header>
						<p>{provider.description}</p>
						<p class="provider-notice">{provider.notice}</p>
						<nav aria-label={`${provider.name} source documentation`}>
							<a href={provider.website} target="_blank" rel="noreferrer">
								Provider
							</a>
							<a href={provider.docs} target="_blank" rel="noreferrer">
								Data documentation
							</a>
							<a href={provider.terms} target="_blank" rel="noreferrer">
								Terms
							</a>
							{provider.brand ? (
								<a href={provider.brand} target="_blank" rel="noreferrer">
									Brand assets
								</a>
							) : null}
						</nav>
					</article>
				))}
			</div>
		</section>
	);
}

export const methodologies = Route.get("/methodology", () => (
	<Page
		title="Valuation methodologies"
		description="A plain-language directory of Rai’s Polymarket-based company valuation methods and their distinct measurement targets."
	>
		<MethodologiesPage />
	</Page>
));

function MethodologiesPage() {
	const applied = new Set<string>(
		companies.flatMap((company) =>
			company.methods.map((assignment) => assignment.method),
		),
	);
	applied.add(ensemble);

	return (
		<main id="content">
			<section class="methodology-hero">
				<div class="shell">
					<Eyebrow>Methodology</Eyebrow>
					<div class="methodology-hero-grid">
						<h1>Different contracts, one derived current estimate.</h1>
						<div class="prose">
							<p>
								The IPO ladder estimates a current equivalent of future
								first-day public capitalization. The threshold curve estimates a
								deadline maximum and bridges it to a current equivalent.
							</p>
							<p>
								Rai’s ensemble then combines those comparable current-equivalent
								outputs with explicit method and evidence-family weights.
							</p>
						</div>
					</div>
					<dl class="methodology-stats">
						<div>
							<dt>Documented {plural(methods.length, "method", "methods")}</dt>
							<dd>{methods.length}</dd>
						</div>
						<div>
							<dt>Currently applied</dt>
							<dd>{applied.size}</dd>
						</div>
						<div>
							<dt>Active data source</dt>
							<dd>Polymarket</dd>
						</div>
					</dl>
				</div>
			</section>

			<section
				class="shell methodology-catalog"
				aria-labelledby="method-directory"
			>
				<header class="methodology-catalog-heading prose">
					<Eyebrow>Method directory</Eyebrow>
					<h2 id="method-directory">What each method does</h2>
					<p>
						These summaries omit the math. Open a method for its complete
						definition and data-source requirements.
					</p>
				</header>

				<div class="methodology-cards">
					{methods.map((method, i) => {
						const companiesUsingMethod =
							method.name === ensemble
								? companies
								: companies.filter((company) =>
										company.methods.some(
											(assignment) => assignment.method === method.name,
										),
									);
						const sources = getMethodProviders(method.name);
						const inactive =
							method.content.frontmatter.status.startsWith("Inactive");

						return (
							<article class="methodology-card">
								<header>
									<span class="methodology-number">
										{String(i + 1).padStart(2, "0")}
									</span>
									<span
										class={`methodology-status ${inactive ? "inactive" : "active"}`}
									>
										{method.content.frontmatter.status}
									</span>
								</header>
								<h2>{method.content.frontmatter.title}</h2>
								<p>{method.content.frontmatter.summary}</p>
								<dl>
									<div>
										<dt>Use</dt>
										<dd>
											{companiesUsingMethod.length
												? `${companiesUsingMethod.length} company ${
														companiesUsingMethod.length === 1
															? "model"
															: "models"
													}`
												: "Not currently assigned"}
										</dd>
									</div>
									<div>
										<dt>Sources</dt>
										<dd>
											{sources.length
												? sources.map((source) => source.name).join(", ")
												: "None configured"}
										</dd>
									</div>
								</dl>
								<methodology.Anchor
									class="methodology-card-link"
									params={{ method: method.name }}
								>
									Read the full method <span aria-hidden="true">→</span>
								</methodology.Anchor>
							</article>
						);
					})}
				</div>
			</section>

			<section class="shell methodology-primer">
				<div class="prose">
					<Eyebrow>How to read the results</Eyebrow>
					<h2>Read each result according to its target.</h2>
				</div>
				<ol>
					<li>
						<span>01</span>
						<div>
							<strong>Start with evidence</strong>
							<p>Polymarket supplies contract prices and source rules.</p>
						</div>
					</li>
					<li>
						<span>02</span>
						<div>
							<strong>Convert to a current equivalent</strong>
							<p>
								Each method applies its documented time and scenario assumptions
								before it enters the combined estimate.
							</p>
						</div>
					</li>
					<li>
						<span>03</span>
						<div>
							<strong>Combine with explicit weights</strong>
							<p>
								Rai averages within evidence families first, then across
								families. The input range remains visible beside the result.
							</p>
						</div>
					</li>
				</ol>
			</section>
		</main>
	);
}

export const health = Route.get("/health", (c) =>
	c.json({
		status: "ok",
		framework: "ovr",
		companies: companies.length,
		methods: methods.length,
	}),
);

export const methodology = Route.get("/methodology/:method", (c) => {
	const alias = new Map([
		["polymarket-ipo", "prediction-market-ipo"],
		[
			"polymarket-valuation-thresholds",
			"prediction-market-valuation-thresholds",
		],
	]).get(c.params.method);
	if (alias) return c.redirect(`/methodology/${alias}`, 301);

	const method = getMethod(c.params.method);
	if (!method) {
		c.res.status = 404;
		return (
			<Page title="Method not found">
				<main id="content" class="shell empty-state">
					<Eyebrow>404 · Methodology</Eyebrow>
					<h1>No Markdown file matches this method.</h1>
					<methodology.Anchor
						class="button"
						params={{ method: "prediction-market-ipo" }}
					>
						View the IPO method
					</methodology.Anchor>
				</main>
			</Page>
		);
	}

	const position = methods.indexOf(method);
	const previous = position > 0 ? methods[position - 1] : undefined;
	const next =
		position < methods.length - 1 ? methods[position + 1] : undefined;
	const entry = method.content;
	const applied =
		method.name === ensemble
			? companies.length
			: companies.filter((company) =>
					company.methods.some(
						(assignment) => assignment.method === method.name,
					),
				).length;

	return (
		<Page
			title={entry.frontmatter.title}
			description={entry.frontmatter.description}
		>
			<main id="content">
				<section class="method-hero">
					<div class="shell">
						<methodologies.Anchor class="method-breadcrumb">
							Methodology <span aria-hidden="true">/</span>{" "}
							{entry.frontmatter.eyebrow}
						</methodologies.Anchor>
						<div class="method-hero-grid">
							<div>
								<div class="method-kicker">
									<span class="method-status">
										<i aria-hidden="true" />
										{entry.frontmatter.status}
									</span>
									<span>{entry.frontmatter.updated}</span>
								</div>
								<h1>{entry.frontmatter.title}</h1>
							</div>
							<div class="method-abstract">
								<p>{entry.frontmatter.description}</p>
								<dl>
									<div>
										<dt>Reading time</dt>
										<dd>{entry.frontmatter.readTime}</dd>
									</div>
									<div>
										<dt>Applies to</dt>
										<dd>
											{applied} company {applied === 1 ? "model" : "models"}
										</dd>
									</div>
								</dl>
							</div>
						</div>
					</div>
				</section>

				<div class="shell method-layout">
					<aside class="method-toc">
						<p>On this page</p>
						<nav aria-label="Method contents">
							{entry.headings
								.filter((heading) => heading.level === 2 || heading.level === 3)
								.map((heading) => (
									<methodology.Anchor
										class={heading.level === 3 ? "toc-sub" : undefined}
										params={{ method: method.name }}
										hash={heading.id}
									>
										{heading.name}
									</methodology.Anchor>
								))}
							<methodology.Anchor
								params={{ method: method.name }}
								hash="data-sources"
							>
								Data sources and permissions
							</methodology.Anchor>
						</nav>
						<div>
							<span>Method ID</span>
							<strong>{method.name}</strong>
						</div>
					</aside>

					<article class="method-prose prose">
						{Render.html(entry.html)}
						<MethodSources method={method.name} />
					</article>
				</div>

				<section class="shell method-navigation">
					{previous ? (
						<methodology.Anchor params={{ method: previous.name }}>
							<span>Previous method</span>
							<strong>{previous.content.frontmatter.title}</strong>
						</methodology.Anchor>
					) : (
						<methodologies.Anchor>
							<span>All methods</span>
							<strong>Methodology index</strong>
						</methodologies.Anchor>
					)}
					{next ? (
						<methodology.Anchor params={{ method: next.name }}>
							<span>Next method</span>
							<strong>{next.content.frontmatter.title}</strong>
						</methodology.Anchor>
					) : (
						<dashboard.Anchor>
							<span>Applied estimates</span>
							<strong>Company valuations</strong>
						</dashboard.Anchor>
					)}
				</section>
			</main>
		</Page>
	);
});
