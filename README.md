# E-commerce purchase server

A small purchase/credit/refund system sitting in front of an external
Customers/Products/Shipments API (per the provided OpenAPI spec). Built for the
ControlPlane home assignment.

## Layout

npm workspaces monorepo:

```
packages/
  server/              the actual system: credit, purchases, refunds
  mock-external-api/   stands in for the external Customers/Products/Shipments API
  admin-ui/            React admin console for customer service reps (bonus)
tests/e2e/             end-to-end tests, driven over real HTTP against built binaries
```

`server` never reads Customer/Product data or writes Shipments directly - it
only ever calls out to `mock-external-api` over HTTP, exactly as it would call
the real external service. Swap the three `*_API_BASE_URL` env vars to point
at the real thing.

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

This brings up all three services, wires the server at the Docker-network
addresses of the other two, and persists the server's SQLite file in a named
volume (`server-data`) so it survives restarts.

Seed data lives in `packages/mock-external-api/src/data.ts`: two customers and
three products, one of which (`OUT-OF-STOCK-003`) always fails shipment - used
to exercise the rollback path.

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

Everything lives in SQLite (see `packages/server/src/db/schema.sql`):

- **`credit_ledger`** - append-only. Every grant, deduct, purchase, and refund
  is a row with a signed `amount` and the resulting `balance_after`. A
  customer's balance is never stored as a mutable counter; it's always "the
  `balance_after` of the most recent ledger row." This is the audit trail the
  assignment asks for: for any balance change you can see exactly when it
  happened and why (`reason`, `type`, `related_purchase_id`).
- **`purchases`** - one row per purchase, snapshotting the unit price, any
  promo discount, and the resulting total *at the time of purchase* - since
  the external Product price can change later, the purchase record must not
  drift with it.
- **`refunds`** - one row per refund event against a purchase (there can be
  several, for partial refunds). A purchase's `status` (`COMPLETED` /
  `PARTIALLY_REFUNDED` / `REFUNDED`) is derived from the sum of its refunds.
- **`promo_codes`** - seeded with two demo codes (`WELCOME10` = 10% off,
  `FIVEOFF` = $5 off) since there's no promo-code management UI in scope.

## Purchase flow / atomicity

The one hard invariant in the spec: *if `CreateShipment` fails, nothing about
the purchase may be persisted and credit must not move.*

`purchaseProduct` therefore does the shipment call **before any database
write**, and only opens a transaction (insert purchase row + append ledger
entry + bump promo usage) once the shipment has actually succeeded. If the
shipment call throws, the function throws too, and the route handler returns
an error with nothing written.

One gap I'm knowingly leaving open: if the shipment succeeds but the
subsequent DB transaction fails (disk full, process killed, etc.), we'd have
a real shipment with no local record of the purchase or the deducted credit -
a classic distributed-transaction problem. Fixing it properly means either a
saga (record "shipment requested" before calling out, reconcile on restart) or
an outbox pattern. I skipped it here because it's a low-probability failure
mode for a take-home and would add real complexity; in production I'd want at
least the "requested" pre-write.

## Notable design choices / things I sidestepped

- **Persistence: SQLite via `node:sqlite`, not Postgres.** I originally
  reached for `better-sqlite3`, but it needs a native build step
  (`node-gyp`), and this container doesn't have Xcode Command Line Tools
  installed - a good proxy for "don't assume the grading box has a C++
  toolchain." Node 22.5+ ships a built-in `node:sqlite` (still experimental,
  hence the `--experimental-sqlite` flag you'll see in the run scripts and
  Dockerfiles) that needed zero native compilation and worked everywhere I
  tried it. For a real production service handling billing data I'd use
  Postgres - multiple app instances can't safely share one SQLite file, and
  you'd want proper replication - but for a single-instance assessment
  service, embedding the DB means the docker-compose file doesn't need a
  separate database container at all.
- **Customer identity is validated against the external API, not assumed.**
  `GET /customers/:id/credit` (and grant/deduct/purchase/list) all call the
  external Customers API first and 404 if it doesn't know the customer,
  rather than silently returning a zero balance for a typo'd ID.
- **"Known customers" in the admin UI** is *our* customers - i.e. anyone with
  at least one local purchase or credit-ledger row - because the external
  Customers API in the spec has no "list all customers" endpoint. A brand-new
  customer with no history yet won't show up in that list; the admin UI has a
  "jump to customer ID" field for that case.
- **Refunds** can be specified either as a `quantity` (pro-rated off the
  purchase's unit price) or a flat `amount` (e.g. a goodwill credit not tied
  to units). Refunds do not attempt to reverse the shipment - there's no
  "return shipment" endpoint in the provided API, so that's out of scope; a
  real implementation would need one.
- **Caching**: Customer/Product GET calls go through a small in-memory TTL
  cache (`packages/server/src/external/cache.ts`, default 30s) in front of the
  API clients, so repeated reads of the same customer/product don't round-trip
  every time, while still bounding how stale a cached price/address can get.
- **e2e tests spawn the real built server and mock API as child processes**
  and talk to them over plain HTTP, rather than importing the Express app
  in-process inside Vitest. I tried the in-process route first; Vite's
  built-in-module detection doesn't yet recognize `node:sqlite` (it's new
  enough to be missing from `module.builtinModules`), so it tried to bundle it
  as an npm package and failed. Driving real processes over HTTP sidesteps that
  entirely and is arguably a more honest end-to-end test anyway.

## Testing

```
npm run test:e2e
```

Builds `mock-external-api` and `server`, boots both as real processes on
free ports, and runs through credit adjustments, a full purchase, the
shipment-failure rollback, promo codes, and partial/full refunds over HTTP.
