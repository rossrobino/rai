---
title: Rai current valuation ensemble
description: The method for combining comparable current-equivalent estimates into Rai’s headline current valuation.
summary: Normalizes method influence within each evidence family, then combines family estimates with explicit weights while preserving the input range.
eyebrow: Method 03
status: Active
order: 3
updated: July 29, 2026
readTime: 5 minute read
---

## What this method measures

This method answers:

> Given several model outputs expressed as current-equivalent company values, what single current valuation should Rai report?

The result is a model-derived estimate, not a directly traded price or an appraisal. Every input must first be converted to a current-equivalent value by its own documented method.

For the MVP, the component inputs come from Polymarket. The IPO ladder produces an IPO-cap current equivalent. The valuation threshold curve produces a deadline-peak current equivalent using its stated growth-rate bridge.

<aside class="method-note">
<strong>Current implementation</strong>
<p>All active inputs belong to one prediction-market evidence family. Distinct valuation methods receive equal total weight. When Polymarket provides more than one closely related IPO ladder for the same company, Rai splits the IPO method’s weight across those ladders so additional contract coverage does not give IPO evidence more influence than the independent threshold curve.</p>
</aside>

## 1. Produce comparable inputs

Let $x_m$ be the current-equivalent estimate from method $m$.

The ensemble does not combine the threshold method’s future maximum directly with the IPO method. It uses the threshold method’s current-equivalent bridge so both inputs refer to the calculation date.

This does not make their capitalization definitions identical. It makes the time target comparable enough to construct an explicit model estimate, with the remaining measurement difference treated as model uncertainty.

## 2. Combine methods within an evidence family

Each method has a non-negative configured weight $w_m$. For evidence family $f$, Rai calculates

$$
F_f =
\frac{\sum_{m \in f} w_m x_m}
{\sum_{m \in f} w_m}.
$$

Normalizing inside the family prevents a family from gaining influence merely because it contains more methods.

If every distinct valuation method has equal total weight, this is an arithmetic mean across methods. Multiple correlated contract sets for one method divide that method’s allocation rather than creating additional weight.

## 3. Combine evidence families

Each evidence family has a configured weight $W_f$. The Rai current valuation is

$$
V_{\text{Rai}} =
\frac{\sum_f W_f F_f}
{\sum_f W_f}.
$$

The two-stage calculation matters when Rai adds fundamentals, secondary-market observations, or another genuinely distinct evidence family. Several closely related prediction-market methods remain one family before the family-level combination.

## 4. Report disagreement

Rai reports the smallest and largest positively weighted method inputs:

$$
V_{\min} = \min_m x_m,
\qquad
V_{\max} = \max_m x_m.
$$

The displayed input spread is

$$
S = \frac{V_{\max} - V_{\min}}{V_{\text{Rai}}}.
$$

A wide range is not hidden by the average. It signals sensitivity to the source contracts, target definition, or bridge assumptions.

## 5. Handle unavailable methods

The live estimate uses the positively weighted methods that are available for the response. If an assigned method fails, Rai marks the estimate as incomplete and reports the unavailable-method count.

The estimate is not persisted in the MVP. It can change when Polymarket prices or configured assumptions change.

## Interpretation

The headline should be read as:

> Rai’s weighted current valuation, conditional on the displayed prediction-market prices, method assumptions, target bridges, and configured weights.

It is not a financing price, an ownership transaction, intrinsic value, or investment advice.

## Limitations

- The active methods can share market participants and narrative information, so they are not statistically independent.
- Equal total method weights are a transparent MVP rule, not an empirically calibrated claim of equal forecasting accuracy.
- The threshold current-equivalent input depends on an explicit growth-rate bridge.
- IPO capitalization and provider-defined NPM Price do not use identical capitalization definitions.
- Open-ended outcome brackets and valuation tails require representative-value assumptions.
- A weighted mean can look precise even when the component models disagree; the input range should always be read with the headline.
