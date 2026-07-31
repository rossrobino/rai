# Rai

Rai is an open-source research interface that converts public Polymarket prices
into derived current private-company valuations.

The MVP intentionally uses one external market-data source: Polymarket. It
stores one daily valuation observation in Turso so changes can be inspected over
time.

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
With the MVP’s single Polymarket evidence family, each distinct available
method receives equal total weight. Closely related ladders split one method’s
allocation rather than gaining extra influence from additional contracts.

## Stack

- OVR routes, server components, schemas, and streaming
- Domco and Vite
- TypeScript
- `@robino/md` with the Vite import plugin
- `@mdit/plugin-katex` and KaTeX
- uico plus a layered `+style.css`
- native `fetch` for Polymarket’s public Gamma and Data APIs
- Drizzle ORM and Turso for historical observations
- Apache ECharts for client-side history charts

## Local development

```sh
npm install
npm run db:migrate
npm run dev
```

Copy `.env.example` to `.env` and configure:

- `TURSO_URL` — the Turso database URL;
- `TURSO_TOKEN` — a token with permission to read and write that database;
- `CRON_SECRET` — a long random value used to authenticate the snapshot route.

Vite loads the local `.env` file into the server process. Browser code does not
receive these values.

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

Set `TURSO_URL`, `TURSO_TOKEN`, and `CRON_SECRET` in the Vercel project before
deploying. The generated deployment configuration registers
`/api/cron/snapshot-valuations` at `0 12 * * *`, or 12:00 UTC once per day. This
fits the Hobby plan’s daily cron limit. Vercel sends `CRON_SECRET` as a bearer
token; the route rejects unauthenticated requests and is marked `no-store`.

ISR and the snapshot job are independent. The job writes one observation per
UTC date. Company pages read the saved history during server rendering and can
remain cached for up to the configured 10-minute ISR interval after a write.
Repeated job requests on the same UTC date are idempotent.

## Routes

- `/` — project overview
- `/dashboard` — one derived current valuation per company with its component inputs
- `/companies/:name` — derived valuation and company method directory
- `/companies/:name?method=:method` — a method’s current calculation and audit
- `/api/companies/:name/methods/:method` — a versioned JSON export of the
  current source observations, assumptions, and calculation
- `/api/cron/snapshot-valuations` — authenticated daily history writer
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
the observation. The daily job stores the combined estimate, its range, method
availability, and every contributing current-equivalent method input. Company
pages query up to 365 observations in an async server component, then load the
ECharts module only when chart data is present. Each company-method page also
links to a versioned JSON export of the current calculation.

The database schema is in `src/server/db/schema.ts`; generated SQL migrations
are committed under `drizzle/`. Run `npm run db:generate` after schema changes
and `npm run db:migrate` to apply pending migrations.

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
