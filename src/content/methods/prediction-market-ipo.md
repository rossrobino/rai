---
title: Prediction-market IPO ladder
description: A method for converting mutually exclusive Polymarket IPO market-cap outcomes into an IPO-cap current equivalent.
summary: Uses market odds for first-day IPO capitalization, then converts the future IPO branch and a current private-company branch into comparable present-day values.
eyebrow: Method 01
status: Active
order: 1
updated: July 31, 2026
readTime: 7 minute read
---

## What this method measures

This method answers:

> Given Polymarket prices for a company’s first-day public market capitalization, what current-equivalent capitalization do those prices imply under explicit scenario assumptions?

The source rules define first-day public market capitalization as regular-hours share price multiplied by outstanding common shares. This is not fully diluted equity value, enterprise value, or intrinsic value.

Polymarket supplies the outcome prices. Rai supplies the representative bracket values, a current no-IPO private scenario, the expected valuation date, and the discount rate.

<aside class="method-note">
<strong>Current implementation</strong>
<p>Rai applies this method where the company catalog contains a complete Polymarket IPO ladder that passes the configured event, market-title, and source-rule checks. Polymarket is the sole external market-data source in the MVP.</p>
</aside>

## 1. Define non-overlapping outcomes

Polymarket expresses the forecast as separate binary markets. Rai maps the configured markets into one canonical set of mutually exclusive IPO-cap brackets plus “no IPO by the deadline.”

Closed brackets use their midpoint. Open brackets require explicit representative values. Aggregate contracts that overlap with configured component brackets are excluded.

## 2. Select a source probability

Rai selects one quote for each outcome using:

1. the displayed midpoint of a valid best bid and ask;
2. the last trade when a two-sided quote is unavailable;
3. Polymarket’s Gamma “Yes” price as a fallback.

The “Yes” outcome is located by its label rather than assumed to occupy a fixed array position. Rai also validates the event slug, market title, source rules, and bid–ask ordering.

## 3. Normalize the ladder

Separate binary prices rarely sum to exactly 100%. If $q_i$ is the selected price and

$$
Q=\sum_{i=1}^{n}q_i,
$$

then the normalized outcome probability is

$$
p_i=\frac{q_i}{Q}.
$$

Rai displays both values and warns when the raw total is materially different from 100%.

## 4. Separate IPO probability and IPO size

If $p_{\text{no IPO}}$ is the normalized no-IPO probability, then

$$
P(\text{IPO})=1-p_{\text{no IPO}}.
$$

For IPO bracket $i$:

$$
P(i\mid\text{IPO})=\frac{p_i}{P(\text{IPO})}.
$$

The conditional expected first-day capitalization is

$$
V_{\text{IPO}}=
\sum_{i\in\text{IPO brackets}}
P(i\mid\text{IPO})v_i.
$$

## 5. Put both branches on a current basis

The IPO capitalization is a future outcome and is discounted:

$$
V_{\text{IPO},0}=\frac{V_{\text{IPO}}}{(1+r)^T},
$$

where $r$ is the annual discount rate and $T$ is the fractional number of years to the expected valuation date.

The no-IPO input is explicitly a **current** private-company scenario value, $V_{\text{private},0}$. It is not discounted again. The headline result is:

$$
V_0=
P(\text{IPO})V_{\text{IPO},0}
+
p_{\text{no IPO}}V_{\text{private},0}.
$$

This treatment avoids the timing mismatch of discounting a present-day private scenario as if it were a future value.

## Assumption provenance

Every company assignment records:

- the date and reference URL for the current private scenario;
- a short rationale and basis label;
- the expected IPO-cap date and annual discount rate;
- lower and upper sensitivity values for the discount rate and private scenario;
- representative values for open-ended IPO brackets.

These inputs are analyst scenarios, not facts inferred from Polymarket. The company page exposes them and their sensitivity results.

## Data provenance and freshness

For every outcome Rai retains the source URL, event and market identifiers, bid, ask, last trade, selected quote, volume, liquidity, Polymarket record update time, and Rai fetch time.

API requests use an eight-second timeout. Successful event responses are cached in memory for 60 seconds to reduce duplicate requests during server-component streaming. The cache is cleared by a server restart. The MVP does not yet maintain an immutable historical quote database, so a later run may not reproduce an earlier live quote unless it was recorded externally.

Each company-method page provides a versioned JSON export containing the configured method, source observations, assumptions, fetch time, and calculated output. Saving that response preserves the inputs for one run.

## Sensitivity and limitations

The page varies the discount rate and current no-IPO value over configured ranges. Those results are scenario sensitivity, not statistical confidence intervals.

Important limitations include:

- prices may be illiquid, stale, wide, or temporarily distorted;
- normalizing related binary markets makes the chosen ladder complete but does not make separate order books jointly coherent;
- open brackets and the no-IPO scenario require outside judgment;
- outstanding-share IPO capitalization can differ materially from fully diluted private-company value;
- capital raised, future dilution, debt, cash, and operating fundamentals are not modeled.

The result should be read as an IPO-cap current equivalent under the displayed market quotes and assumptions, not as an appraisal or investment recommendation.

## Reproduction checklist

1. Fetch every configured Polymarket event by exact slug.
2. Validate the source rules and match exact market titles.
3. Map Gamma outcomes by the “Yes” label.
4. Select midpoint, last trade, or Gamma price in that order.
5. Normalize the mutually exclusive ladder.
6. Calculate conditional IPO capitalization and discount only that future branch.
7. Mix it with the current no-IPO private scenario.
8. Preserve provider and fetch timestamps, quotes, assumptions, intermediate values, warnings, and URLs.
