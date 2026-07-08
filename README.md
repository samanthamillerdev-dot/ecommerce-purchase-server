# E-commerce purchase server

A purchase/credit/refund system that sits in front of an external Customers/Products/Shipments
API (see the provided OpenAPI spec). Built for the ControlPlane home assignment.

## Layout

It's an npm workspaces monorepo:

```
packages/
  server/              the actual system: credit, purchases, refunds
  mock-external-api/   stands in for the external Customers/Products/Shipments API
  admin-ui/            React admin console for customer service reps (bonus)
tests/e2e/             end-to-end tests, driven over real HTTP against built binaries
```

`server` never touches Customer/Product data or Shipments directly - it only ever calls
`mock-external-api` over HTTP, the same way it would call the real thing. Point the three
`*_API_BASE_URL` env vars at the real service and nothing else needs to change.

## Running it

```
npm install
npm run dev              # all three, via concurrently
```

or individually:

```
npm run dev:mock-api     # :4001
npm run dev:server       # :3000
npm run dev:admin-ui     # :5173
```

Or with Docker:

```
docker compose up --build
```

That brings up all three services, points the server at the other two over the Docker
network, and keeps the server's SQLite file in a named volume (`server-data`) so it
survives a restart.

Seed data is in `packages/mock-external-api/src/data.ts` - two customers, three products.
One product (`OUT-OF-STOCK-003`) always fails shipment on purpose, so there's an easy way
to exercise the rollback path by hand.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/customers/:id/credit` | current balance |
| GET | `/customers/:id/credit/history` | full ledger for a customer |
| POST | `/customers/:id/credit/grant` | `{ amount, reason }` |
| POST | `/customers/:id/credit/deduct` | `{ amount, reason }` |
| POST | `/purchases` | `{ customerId, productId, quantity, promoCode?, shippingAddress? }` |
| GET | `/customers/:id/purchases` | purchase history with refund totals |
| POST | `/purchases/:id/refund` | `{ quantity }` or `{ amount }`, plus optional `reason` |
| GET | `/admin/customers` | known customers + balance, for the admin UI |
| GET | `/admin/customers/:id` | one customer's full detail, for the admin UI |

## Data model

Everything lives in SQLite (`packages/server/src/db/schema.sql`).

`credit_ledger` is the important one - it's append-only. Every grant, deduct, purchase,
and refund shows up as a row with a signed `amount` and the resulting `balance_after`.
A customer's balance is never stored as a mutable counter, it's always just "the
balance_after of the most recent row for that customer." That's what gives you the audit
trail the assignment asks for - for any balance change you can see exactly when it
happened and why, via `reason`, `type`, and `related_purchase_id`.

`purchases` snapshots the unit price and any promo discount at the moment of purchase,
because the external product price can change later and the purchase record shouldn't
drift along with it. `refunds` is one row per refund event (a purchase can have several,
for partial refunds), and a purchase's status - `COMPLETED` / `PARTIALLY_REFUNDED` /
`REFUNDED` - is just derived from summing them up.

`promo_codes` has a handful of seeded demo codes, since there's no code-management UI in
scope: `WELCOME10` (10% off), `FIVEOFF` ($5 off), `EXPIRED5` (already expired, for testing
rejection), and `ONETIME10` (10% off, single use, for testing the usage-limit path).

## Purchase flow / atomicity

The one hard invariant here: if `CreateShipment` fails, nothing about the purchase can be
persisted and credit must not move.

So `purchaseProduct` calls Shipments before touching the database at all, and only opens
a transaction - insert the purchase row, append a ledger entry, bump promo usage - once
the shipment has actually succeeded. If the shipment call throws, the function throws too
and nothing gets written.

One gap I'm leaving open on purpose: if the shipment succeeds but the transaction after it
fails (disk full, process killed mid-write, whatever), you end up with a real shipment and
no local record of the purchase or the deducted credit. That's a classic
distributed-transaction problem. The real fix is a saga - write a "shipment requested"
record before calling out, reconcile on restart - or an outbox pattern. I didn't build that
here; it's a low-probability failure for a take-home and it adds real complexity for not
much payoff at this scale. In production I'd at least want the pre-write.

## Design choices and things I sidestepped

I originally reached for `better-sqlite3`, but it needs a native build step (node-gyp),
and this machine didn't have Xcode Command Line Tools installed - a decent proxy for "the
grading box might not have a C++ toolchain either." Node 22.5+ ships a built-in
`node:sqlite` that needed zero native compilation and just worked everywhere I tried it
(still experimental, hence the `--experimental-sqlite` flag in the run scripts and
Dockerfiles). For a real production service handling billing data I'd reach for Postgres
instead - multiple app instances can't safely share one SQLite file and you'd want proper
replication - but for a single-instance assessment service, embedding the DB meant the
compose file didn't need a separate database container at all.

Customer identity gets checked against the external API rather than assumed. `GET
/customers/:id/credit` and friends all call the external Customers API first and 404 if it
doesn't recognize the ID, instead of quietly handing back a zero balance for a typo'd
customer.

"Known customers" in the admin UI just means our customers - anyone with at least one
local purchase or credit-ledger row - because the external Customers API has no "list
everyone" endpoint. A brand-new customer with no history won't show up there yet, which is
why the admin UI also has a plain "jump to customer ID" field.

Refunds take either a `quantity` (pro-rated off the purchase's unit price) or a flat
`amount` for something like a goodwill credit that isn't tied to units. They don't try to
reverse the shipment, since there's no "return shipment" endpoint in the provided API -
a real implementation would need one.

Customer/Product GET calls go through a small in-memory TTL cache (30s by default, see
`packages/server/src/external/cache.ts`) so repeated reads of the same record don't
round-trip every time, while still keeping a bound on how stale a cached price or address
can get.

The e2e tests spawn the real built server and mock API as actual child processes and talk
to them over plain HTTP, instead of importing the Express app in-process inside Vitest. I
tried the in-process route first, but Vite's built-in-module detection doesn't recognize
`node:sqlite` yet (it's new enough to be missing from `module.builtinModules`), so it tried
to bundle it like an npm package and blew up. Driving real processes over HTTP sidesteps
that entirely, and honestly feels like a more legitimate end-to-end test anyway.

## Testing

```
npm run test:e2e
```

Builds `mock-external-api` and `server`, boots both as real processes on free ports, and
runs through credit adjustments, a full purchase, the shipment-failure rollback, promo
codes (valid, unknown, expired, usage-limit-exhausted), and partial/full refunds - all over
HTTP.
