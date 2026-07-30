# Rai

Rai is an open-source research interface that converts public Polymarket prices
into derived current private-company valuations.

The MVP intentionally uses one external market-data source: Polymarket. It does
not use a database or a persistent cache.

## What Rai calculates

Rai currently implements two component methods and one ensemble:

1. **Prediction-market IPO ladder** — estimates an IPO-cap current equivalent
   from mutually exclusive first-day public market-cap outcomes. The future IPO
   branch is discounted; the no-IPO branch uses a dated current private scenario and
   is not discounted again.
2. **Valuation threshold curve** — estimates the maximum qualifying NPM Price
   reached by a contract deadline, then applies an explicit growth bridge to
   derive a deadline-peak current equivalent.
3. **Rai current valuation ensemble** — averages current-equivalent methods
   within each evidence family using configured method weights, then combines
   the family estimates using configured family weights.

The dashboard’s headline is the ensemble result. Component estimates, their
range, weights, assumptions, and source calculations remain visible for audit.
With the MVP’s single Polymarket evidence family and equal method weights, two
available methods receive equal weight.

## Stack

- OVR routes, server components, schemas, and streaming
- Domco and Vite
- TypeScript
- `@robino/md` with the Vite import plugin
- `@mdit/plugin-katex` and KaTeX
- uico plus a layered `+style.css`
- native `fetch` for Polymarket’s public Gamma and Data APIs

## Local development

```sh
npm install
npm run dev
```

Useful checks:

```sh
npm run check
npm test
npm run build
```

## Vercel deployment

The official `@domcojs/vercel` adapter runs during `npm run build` and produces
a Vercel Build Output API bundle in `.vercel/output`.

In Vercel, select the **Other** framework preset and leave the build and output
settings at their defaults. Vercel will run the package build script and use the
generated serverless function and static assets.

## Routes

- `/` — project overview
- `/dashboard` — one derived current valuation per company with its component inputs
- `/companies/:name` — derived valuation and company method directory
- `/companies/:name?method=:method` — a method’s current calculation and audit
- `/api/companies/:name/methods/:method` — a versioned JSON export of the
  current source observations, assumptions, and calculation
- `/methodology` — method directory
- `/methodology/:method` — build-time-rendered methodology document

All internal links use OVR route anchors.

## Data model and runtime behavior

Company configuration lives in `src/server/company-data.ts` and is validated
with OVR schemas from `src/server/company-schema.ts`. Each assignment declares:

- its method and measurement target;
- exact Polymarket events and market titles;
- representative values and dated assumption provenance;
- sensitivity ranges;
- claim semantics and source-rule URLs where applicable.

Live Polymarket responses are fetched inside streamed server components when
possible. Requests have an eight-second timeout. Successful Gamma event
responses are cached in memory for 60 seconds and participant lookups for five
minutes. Failed requests are not cached. The cache resets with the server.

Rai records both Polymarket’s source-record update time and its own fetch time in
the in-memory observation used for a response. The MVP does not persist
historical observations, so the current audit is inspectable but not an
immutable research archive. Each company-method page links to a versioned JSON
export that can be saved as a reproducible observation snapshot.

## Quote selection and validation

For a binary “Yes” contract, Rai uses:

1. displayed best-bid/best-ask midpoint;
2. last trade;
3. Gamma outcome price.

The “Yes” value is found by outcome label, not array position. The fetch layer
also validates event slugs, exact configured titles, bid/ask ordering, and the
NPM Price/deadline semantics of threshold contracts.

Wallet counts are diagnostic liquidity context only. They are not treated as
people and do not weight the threshold fit.

## Polymarket attribution

Rai links every live observation to its Polymarket market and links the provider
directory to Polymarket’s documentation, terms, and brand page. The displayed
Polymarket icon is an unmodified official asset. Rai is independent and is not
affiliated with or endorsed by Polymarket.

- [Polymarket](https://polymarket.com)
- [API documentation](https://docs.polymarket.com/api-reference/introduction)
- [Terms of use](https://polymarket.com/tos)
- [Brand resources](https://polymarket.com/brand)

## License

[MIT](LICENSE). Market data and third-party marks remain subject to their
owners’ terms.
