---
title: Prediction-market valuation threshold curve
description: A method for converting Polymarket valuation-threshold contracts into a distribution for the maximum qualifying valuation reached by a deadline.
summary: Turns a set of “at least this high” contracts into a probability distribution for the maximum valuation reached before a deadline.
eyebrow: Method 02
status: Experimental
order: 2
updated: July 29, 2026
readTime: 6 minute read
---

## What this method measures

This method answers:

> Given Polymarket prices for whether a company reaches several valuation thresholds, what is the expected **maximum qualifying valuation reached by the contract deadline**?

The active contracts resolve using Polymarket’s NPM Price definition through December 31, 2026. This is a path-dependent maximum. It is not the company’s value today, its value on December 31, or an intrinsic valuation.

<aside class="method-note">
<strong>Current implementation</strong>
<p>Rai uses only configured Polymarket “HIGH” contracts. It verifies that each fetched event and market refers to the configured NPM Price claim and deadline before using a quote. Resolved thresholds and contracts without a usable quote are excluded from new company configurations.</p>
</aside>

## 1. Select one quote for each threshold

For thresholds

$$
t_1 < t_2 < \cdots < t_n,
$$

contract $i$ estimates the exceedance probability

$$
q_i \approx P(M \ge t_i),
$$

where $M$ is the highest qualifying NPM Price observed during the contract window.

Rai selects the displayed bid–ask midpoint when both sides are valid, then the last trade, then Polymarket’s Gamma “Yes” price. The midpoint is a descriptive quote between the displayed bid and ask; it is not represented as an executable price.

The “LOW” contracts are excluded because they describe a different path-dependent event.

## 2. Enforce a coherent curve

Reaching a higher threshold implies reaching every lower threshold, so the probabilities must be non-increasing:

$$
1 \ge s_1 \ge s_2 \ge \cdots \ge s_n \ge 0.
$$

Separate contracts can violate this condition because of spreads, liquidity, or update timing. Rai applies an equal-weight isotonic fit:

$$
\underset{s_1,\ldots,s_n}{\operatorname{minimize}}
\quad \sum_{i=1}^{n}(s_i-q_i)^2
\quad
\text{subject to }s_i \ge s_{i+1}.
$$

The fit changes prices only when required to restore logical ordering. Any visible adjustment is retained in the audit table and produces a warning.

Trading-wallet counts are shown as liquidity context only. They do not affect the fit because wallets are not verified people, can be controlled by the same participant, and are not a calibrated measure of forecast precision.

## 3. Convert exceedance probabilities into bands

The threshold events overlap, so adding them would double-count. With a configured lower floor $f<t_1$, Rai differences adjacent fitted probabilities:

$$
\begin{aligned}
p_0 &= 1-s_1,\\
p_i &= s_i-s_{i+1} && \text{for }i=1,\ldots,n-1,\\
p_n &= s_n.
\end{aligned}
$$

The resulting exclusive bands span $[f,t_1)$ through the open upper band $[t_n,\infty)$. Their probabilities are nonnegative and sum to one.

## 4. Assign representative values

Each closed band uses its arithmetic midpoint:

$$
v_i=\frac{\text{lower}_i+\text{upper}_i}{2}.
$$

The lower floor and open upper-tail representative are explicit analyst assumptions because the contracts do not identify them. Every assignment records a date, source URL, rationale, and sensitivity range for these inputs.

The primary output is:

$$
E[M]=\sum_{i=0}^{n}p_iv_i.
$$

## 5. Optional current-equivalent scenario

The contract curve does not identify current value. Rai separately shows what the deadline maximum would equal today under an assumed annual valuation-path rate $g$:

$$
V_0^{\text{scenario}}=\frac{E[M]}{(1+g)^T}.
$$

This is labeled a scenario rather than a second market estimate. It should not be averaged with the IPO-ladder result: the threshold method measures a maximum NPM Price over a window, while the IPO ladder measures first-day public market capitalization based on outstanding shares.

## Data provenance and freshness

For every contract Rai retains:

- source event, market identifier, question, and URL;
- bid, ask, last trade, selected quote, volume, and liquidity;
- Polymarket’s record update time;
- Rai’s fetch time;
- the raw and fitted probabilities.

The two timestamps have different meanings. Provider update time describes Polymarket’s record; fetch time records when Rai observed it. API requests use an eight-second timeout and a short in-memory cache to limit provider traffic. A server restart clears the cache, and the MVP does not yet provide a historical database.

Each company-method page provides a versioned JSON export containing the configured method, source observations, assumptions, fetch time, and calculated output. Saving that response preserves the inputs for one run.

## Sensitivity and limitations

The displayed sensitivity range is not a confidence interval. It shows how the expected maximum changes when the unquoted lower and upper tails change.

Other limitations include:

- prediction-market prices can be thin, stale, wide, or temporarily distorted;
- NPM Price is defined by the source rules and can mix qualifying private and public valuation events;
- a temporary threshold crossing counts even if valuation later falls;
- the open tails are analyst assumptions;
- contracts may share traders, information, and errors;
- the method does not use revenue, margins, dilution, financing terms, or operating risk.

## Reproduction checklist

1. Fetch the configured Polymarket event by exact slug.
2. Verify the NPM Price definition and deadline in the source rules.
3. Match each configured threshold by exact market title.
4. Select midpoint, last trade, or Gamma “Yes” price in that order.
5. Sort thresholds and apply the equal-weight non-increasing isotonic fit.
6. Difference the fitted curve into exclusive bands.
7. Apply the dated lower-floor and upper-tail assumptions.
8. Preserve source URLs, provider and fetch timestamps, raw data, fitted values, assumptions, and warnings.

The implementation rejects missing contracts, malformed quotes, duplicate thresholds, incompatible source rules, a lower floor above the first threshold, or an upper-tail value below the final threshold.
