# Data model

Why the schema looks the way it does. `prisma/schema.prisma` is the authority and
is commented line by line; this document covers the decisions the schema can only
hint at, and the one place where the SRS leaves a gap that had to be filled.

For the diagram, see **[ERD.md](ERD.md)**.

---

## The three rules that shaped everything

### 1. Money is an integer number of paise. Never a float, never `Decimal`.

`priceRetail: 2450000` is ₹24,500.00. Every amount in the database — prices,
order totals, tax, commission, settlements, refunds — is `Int` in paise.

This is not a stylistic preference. An order is split across sellers, each
sub-order is charged commission, and each settlement pays out the remainder. Once
a rounding error is written it cannot be recovered, because nothing downstream
knows what the number was supposed to be. Integers make the arithmetic exact and
make "the parts sum to the whole" an assertion the seed check can actually make.

Where an order-level amount has to be divided between sellers — a coupon funded
by the platform, for instance — it is apportioned by **largest remainder**
(`src/lib/commerce/totals.ts`), so the parts always add up to the original to the
paise.

Ratings follow the same rule scaled ×10: `ratingAvg: 45` renders as 4.5.

### 2. The schema is SQLite locally and valid PostgreSQL as written.

The project has to run on a reviewer's machine with nothing installed, and it has
to be credible as a production design. Both hold at once because the schema
avoids every SQLite-specific and every PostgreSQL-specific construct:

| Avoided | Used instead | Why |
| --- | --- | --- |
| native `enum` | `String` + a TypeScript union in `src/lib/constants.ts` | SQLite has no enums; a migration to add one status value is a table rebuild |
| scalar list fields | a relation, or a JSON-encoded string | not portable |
| `Decimal` | `Int` paise | see rule 1 |

Moving to PostgreSQL is: change `provider` in `prisma/schema.prisma`, change
`DATABASE_URL`, swap the driver adapter in `src/lib/prisma.ts`. **No query code
changes**, because no query depends on the engine.

The cost of this choice is that a status column is not constrained by the
database. It is constrained in TypeScript, in the Zod schemas at every write, and
by the state machines — which is where the interesting constraints live anyway,
since "PLACED may become CONFIRMED but not DELIVERED" is not something an enum
could have enforced.

### 3. A column that is derived must be derived by one function, everywhere.

Two columns exist purely so the database can sort by something it cannot compute:

- **`Product.priceEffective`** — `priceOffer ?? priceRetail`. Prisma cannot
  `orderBy` a `COALESCE`, so "sort by price, low to high" would otherwise order by
  the pre-discount figure and put discounted products in the wrong place.
- **`SupportTicket.priorityRank`** — `priority` is a `String` for portability, and
  ordering a string is alphabetical: CRITICAL, HIGH, LOW, MEDIUM. That puts MEDIUM
  above HIGH.

Sorting in memory instead would break pagination, which is the reason neither is
computed at read time. Each has exactly one pure function that produces it
(`effectiveRetailPaise()`, `ticketPriorityRank()`), every write path calls it, and
`prisma/seed-check.ts` asserts the mirror still agrees with its source.

The same discipline covers `Order.status`, `Inventory.status` and
`Product.ratingAvg`, none of which is ever written by hand — see
"Derived, never set" below.

---

## The multi-seller order model

**This resolves a gap the SRS does not address.** The SRS describes orders and it
describes multiple sellers, but never says what happens when one cart contains
products from two of them — and that is the normal case on a marketplace.

Modelled as three levels:

```
Order        one customer, one payment, one delivery address
  └─ SubOrder    one seller's share — the fulfilment unit
       └─ OrderItem   one product line
```

A basket spanning three sellers is **1 Order + 3 SubOrders + 1 Payment**. The
customer pays once and sees one order number; the warehouse, QC, logistics and
settlement all work on `SubOrder`, never on `Order`, because a parcel is what
gets picked, inspected, shipped and paid for.

Three consequences worth knowing before changing anything here:

- **`Order.status` is derived from its sub-orders and never set directly.**
  `deriveOrderStatus` in `src/lib/fulfilment/order-rollup.ts` is the only writer.
  A summary that can drift from the thing it summarises is precisely the bug this
  model exists to avoid — a two-parcel order with one dispatched and one still
  being picked is `PROCESSING`, and no single status word could have said that.
- **`Order.status` summarises fulfilment, never payment.** Whether the money
  arrived is `Payment.status`. `deriveOrderStatus` can never return `CONFIRMED`,
  so an order sitting in that status would be invisible to every screen that
  filters on the pipeline.
- **`SubOrder.discountAmount` is its own column.** Commission is charged on the
  sub-order's **gross** value, before any platform-funded coupon, so the
  discount share has to be stored separately from the subtotal or the
  settlement arithmetic cannot be reconstructed. The invariant
  `SUM(subtotal − discount + shipping) = Order.totalAmount` is asserted by the
  seed check.

## The fulfilment pipeline

The SRS contradicts itself on who ships the parcel: §61 has the seller packing and
marking "Ready for Pickup"; §93–95 has a **platform warehouse** picking, QC-ing
and packing. This build implements **§93–95**, and the schema was designed around
it from the start — the `SubOrder` status list, `QcInspection` and the four
operations roles only make sense under that model.

So a sub-order's life is:

```
PLACED → CONFIRMED → WAREHOUSE_QUEUE → PICKING → PICKED → QC_PENDING
       → QC_PASSED → PACKING → READY_FOR_DISPATCH → DISPATCHED
       → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
```

with `QC_FAILED → RETURNED_TO_WAREHOUSE → PICKING` as the correction loop, and
`CANCELLED` / `RETURN_REQUESTED → RETURNED` as the exits.

The seller owns exactly one decision — confirm or decline — and `CONFIRMED` is
the handover point. Everything from `WAREHOUSE_QUEUE` to `READY_FOR_DISPATCH`
belongs to operations.

Which moves are legal, and which permission each requires, is **not** in the
schema: it is `src/lib/order-state-machine.ts`, which is pure and has no database
access. Making the move — the status write, the timestamp, the `OrderEvent`, the
stock effect, the parent-order recompute and the customer notification — is
`src/lib/fulfilment/transition.ts`, in one transaction. Every panel renders its
buttons from `availableTransitions()` and every action re-checks with
`assertTransition`, so a control that is not drawn is also not reachable by
posting to it.

### Stock moves in three places, and differently in each

One table in `transition.ts` (`STOCK_EFFECT`) covers all of it:

| Transition | `reservedQty` | `stockQty` | Ledger reason |
| --- | --- | --- | --- |
| `CANCELLED` | released | unchanged | `ORDER_CANCELLED` |
| `DISPATCHED` | released | **reduced** | `ORDER_DISPATCHED` |
| `RETURNED` | unchanged | **increased** | `RETURN_RESTOCK` |

Placing an order reserves; dispatching is the moment the units physically leave,
so that is where the reservation ends *and* the shelf count drops. A cancellation
writes a zero-quantity ledger row on purpose, so the release is traceable rather
than silent.

`StockMovement` is **append-only**. Every change to `Inventory` has a row
explaining it, which is what makes any balance reconstructible. Nothing in the
application deletes or edits one.

---

## Derived, never set

| Column | Derived by | From |
| --- | --- | --- |
| `Order.status` | `deriveOrderStatus` | its sub-orders |
| `Inventory.status` | `deriveInventoryStatus` | `stockQty`, `reservedQty`, the product's own low-stock threshold |
| `Product.ratingAvg` / `ratingCount` | `recomputeProductRating` | **approved** reviews only |
| `Product.priceEffective` | `effectiveRetailPaise` | `priceOffer ?? priceRetail` |
| `SupportTicket.priorityRank` | `ticketPriorityRank` | `priority` |
| `Inventory.reservedQty` (seed) | recomputed from live sub-orders | never incremented per run |

Each of these is shared with `prisma/seed.ts` deliberately, so the seeded database
and a running one cannot disagree about the same row — a class of bug that
otherwise only shows up when a reviewer clicks something the seed never exercised.

---

## The 33 entities

### Identity and access — SRS §16, §17, §88, §172, §173

| Model | Holds |
| --- | --- |
| `Role` | The nine role codes. See [ROLES.md](ROLES.md) for why nine and not eleven |
| `Permission` | The 45 permission codes |
| `RolePermission` | The matrix — a **seeded projection** of `src/lib/auth/permissions.ts`, which is what every check actually consults |
| `User` | One account. `passwordHash` is bcrypt cost 12 and is never selected by the DAL |
| `LoginEvent` | Every attempt, with IP and user agent — succeeded or not |
| `OtpCode` | Verification codes, modelled for registration and recovery |

The RBAC screen in the admin console is read-only, and that is a decision rather
than a shortfall: an editable toggle would change a `RolePermission` row and
change nothing about what anyone is allowed to do. Instead the screen runs a
**drift check** between the seeded rows and the constants.

### Customers and sellers — SRS §34–51, §52–68, §74

| Model | Holds |
| --- | --- |
| `Customer` | The buyer profile. `customerType` is `RETAIL` or `WHOLESALE` — a **tier, not a role**, because both hold identical permissions and differ only in pricing, MOQ and GST |
| `Address` | The address book; an order stores a **copy**, so editing an address never rewrites history |
| `Seller` | The business, its verification state, and its commission rate |
| `SellerDocument` | Per-document KYC, each independently approved or rejected with a reason. A seller cannot be approved until all four are approved |

### Catalogue and inventory — SRS §58–60, §76, §77, §97, §98, §145, §157–159

| Model | Holds |
| --- | --- |
| `Category` | A deliberately two-level tree — parent and child, no deeper. The mega-menu is built from it, and a third level would have no navigation to render it |
| `Product` | Retail and wholesale prices, MOQ, approval state, the derived `priceEffective` and rating roll-up |
| `ProductImage` | Ordered gallery; files are committed under `public/catalogue/` |
| `ProductVariant` | Length, colour or size, each with its own price delta and stock |
| `Inventory` | On hand, reserved, and the per-product low-stock threshold |
| `StockMovement` | The append-only ledger described above |

### Cart, orders and fulfilment — SRS §41–46, §92–111

| Model | Holds |
| --- | --- |
| `CartItem` | The live basket. `variantId` is `String @default("")` rather than nullable — see the gotcha below |
| `WishlistItem` | Saved for later |
| `Order` | What the customer placed and paid for, once |
| `SubOrder` | One seller's fulfilment unit — the row the whole pipeline operates on |
| `OrderItem` | A product line, with the price **as charged**, not as currently listed |
| `OrderEvent` | Append-only transition history: from, to, actor, note |
| `QcInspection` | A verdict plus the 16-point checklist as ticked, and the rejection reason on a failure |
| `Shipment` | Courier, tracking number, current shipment status |
| `ShipmentEvent` | The scan history behind that status |
| `ReturnRequest` | The desk's decision about a return, kept separate from where the parcel physically is |

> **`@@unique` does not constrain NULL columns.** SQL treats `NULL ≠ NULL`, so a
> compound unique containing a nullable column silently exempts every row where it
> is null — and Prisma cannot address a null member of a compound key, which makes
> `upsert` impossible. `CartItem.variantId` was nullable and therefore exempting
> most of the catalogue from its own uniqueness rule. It is now a `""` sentinel
> that readers normalise back to `null`. **A nullable column inside a compound
> unique is almost always a bug.**

### Finance — SRS §116–122

| Model | Holds |
| --- | --- |
| `Payment` | What the gateway did. **Read-only in the application** — `PAYMENT_VIEW` is the only payment permission in the whole matrix, because "mark as paid" would record a fiction. `idempotencyKey` is UNIQUE and written in the same transaction as the Order, which is what stops a double submit |
| `Refund` | Its own state machine: `PENDING → APPROVED → PROCESSED`. Approving and paying are separate states because "agreed but not yet sent" is where a refund spends most of its life |
| `Settlement` | One payout per **delivered** sub-order. `net = gross − commission`, all integers |

No payment gateway is connected, and the checkout page says so. Online methods
record a deliberately synthetic `SIM-<orderNumber>` reference.

### Marketing, content and support — SRS §82–85, §123–129, §130–140

| Model | Holds |
| --- | --- |
| `Coupon` | Code, type, value, minimum, window, redemption cap and count |
| `Banner` | Slot, sort order, link target and its live window |
| `Campaign` | A broadcast and its **reach — a row count of the notifications it actually wrote**, never an assertion. Clicks and conversions stay at zero because there is no analytics pipeline and inventing numbers would be worse |
| `CmsPage` | The seven public content pages. The slug is not editable and a linked page cannot be unpublished |
| `NewsletterSubscriber` | Email captures from the storefront |
| `Review` | Held `PENDING` on submission and does not move the public rating until approved |
| `Notification` | Per-user, categorised. Hangs off `User`, not `Order` — see the seeding note below |
| `SupportTicket` | Number, category, priority, assignee, status |
| `TicketMessage` | The thread. `isInternal` messages are filtered out of the customer's view **in the query**, not in the component |

### Platform — SRS §87, §89

| Model | Holds |
| --- | --- |
| `Setting` | Typed key/value configuration. Checkout reads shipping, GST, COD and returns policy from here, so the admin settings screen controls something real |
| `AuditLog` | Who changed what. Written **inside the transaction that made the change**, so a rolled-back change cannot leave a row claiming it happened. There is no delete control, because an audit trail an administrator can edit is not an audit trail |

---

## Seeding invariants

`prisma/seed.ts` is idempotent: running it twice produces identical counts in
every table. `npx tsx prisma/seed-check.ts` asserts the invariants rather than
asking anyone to spot them — money reconciles, derived columns agree with their
sources, no operations queue is empty, no failed inspection lacks a reason, every
dispatched parcel has a shipment with events, and campaign reach equals the
notifications behind it.

> **A table nothing cascades to will accumulate silently.** `Notification` hangs
> off `User`, not `Order`, so `order.deleteMany({})` never touched it — 453 → 510
> → 567 across three runs, unnoticed for four phases because the seed only
> printed the counts it *rebuilt*. Each seed module now clears the notification
> categories it owns. **Verify idempotency by counting every table the seed
> writes, not the ones it reports.**

Seeded dates are relative to when the seed runs, never literal. A project
unzipped weeks later must not show every "live" coupon and banner expired — that
reads as a broken build rather than as old data.
