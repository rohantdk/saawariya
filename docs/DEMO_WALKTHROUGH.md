# Demo walkthrough

A guided click-path through Saawariya. Follow it in order — it is written so a
reviewer sees the platform the way it is meant to be understood, rather than
clicking around and missing the parts that matter.

Every account uses the password **`Saawariya@123`**.

Sections 1–8 walk the platform in the order it is meant to be understood. Section
9 is three commands that check the whole thing without reading any code.

---

## 1. Authentication and role-based access

The platform has **nine roles**. Each lands somewhere different and can reach
nothing else. This is worth two minutes because everything later depends on it.

### 1.1 Route protection

1. Open **http://localhost:3000** while signed out.
2. Navigate to `/admin` directly.
3. You are redirected to `/login?next=%2Fadmin` — the destination is preserved.

### 1.2 Sign in, and return to where you were headed

4. Sign in as `admin@saawariya.test`.
5. You land on **`/admin`**, not a generic dashboard — the `next` parameter was
   honoured.

> Try `/login?next=https://example.com` too. The redirect is ignored and you land
> on your own dashboard: `next` is restricted to internal paths, so the login
> page cannot be used as an open redirect for phishing.

### 1.3 Roles are isolated

6. Still signed in as admin, navigate to `/seller`.
7. You are bounced back to `/admin`. Admin is not a seller, and being highly
   privileged does not mean being every role.

### 1.4 Two independent layers of authorisation

This is the part worth seeing.

8. Sign out. Sign in as `warehouse@saawariya.test` → lands on
   `/operations/warehouse`.
9. Navigate to `/operations/qc`.

The routing layer (`src/proxy.ts`) **allows** this — Warehouse is an operations
role and `/operations/*` is an operations area. You are still redirected back to
`/operations/warehouse`, because the page itself re-checks with
`requireRole([QC, SUPER_ADMIN])` against the database.

That is deliberate. The proxy is a convenience that keeps signed-out users out of
the routing layer; it is not the security boundary. Server Actions and Route
Handlers are reachable directly regardless of what the proxy allowed, so the
real check lives next to the data.

### 1.5 The session cookie

10. On any signed-in page, open DevTools → Console and run `document.cookie`.

The session is **not** there. It is set `httpOnly`, so cross-site scripting
cannot read it, plus `sameSite=lax` against CSRF and `secure` in production.

---

## 2. The seeded catalogue

The storefront in section 3 renders all of this. The data itself is still worth
inspecting first, because every screen in the application reads from it.

```bash
npm run db:studio
```

Then open the tables below. Or run the sanity check, which asserts the
invariants rather than asking you to spot them:

```bash
npx tsx prisma/seed-check.ts
```

### 2.1 What is in there

| Table | Rows | Worth noticing |
| --- | --- | --- |
| `Category` | 7 + 27 | Two-level tree for the mega-menu; every leaf has products |
| `Seller` | 7 | Spanning **every** verification state, not just approved |
| `Product` | 41 | Across all four approved sellers and every category |
| `ProductImage` / `ProductVariant` | 121 / 72 | Committed files under `public/catalogue/` |
| `Inventory` / `StockMovement` | 41 / 40 | Every product opens with a ledger entry, not bare stock |
| `Review` | 44 | **Every one a verified purchase** — see §2.4; 4 awaiting moderation |
| `Coupon` / `Banner` / `Campaign` | 8 / 8 / 7 | Includes expired, scheduled and switched-off rows, not only live ones |
| `CmsPage` | 7 | Every footer link has a real page behind it |
| `Order` / `SubOrder` | 68 / 70 | Two orders span **two sellers**, so they are two parcels |
| `QcInspection` / `Shipment` | 67 / 49 | Every operations queue has work in it, and no queue is empty |
| `Settlement` / `Refund` | 42 / 5 | Across every state, so the finance desk has real decisions to make |
| `SupportTicket` / `ReturnRequest` | 7 / 5 | Likewise for the support desk |
| `CartItem` / `WishlistItem` | 5 / 7 | Both demo customers arrive with an open bag and saved items, so `/cart`, `/checkout` and the wishlist are not empty |

### 2.2 The approval queues are deliberately not empty

A catalogue where everything is already approved leaves the admin panels with
nothing to review, and an empty screen cannot be evaluated. So:

- **Sellers** — Surat Fabric Mart is a fresh application, Bengal Loom House is
  mid-review with a rejected cheque scan and a note explaining why, and Gupta
  Textiles Depot was rejected for a GSTIN/name mismatch.
- **Products** — five are pending, one is rejected with a reason a seller can
  read, one is the seller's own unpublished draft.
- **Reviews** — four are awaiting moderation.

### 2.3 Pricing is integer paise, and dual-tier

Open any product. `priceRetail` and `priceWholesale` are integers in **paise**
(`2450000` is ₹24,500), never floats — commission splits and settlements have to
reconcile exactly, and rounding drift is unrecoverable once written. Wholesale
sits 25–35% below retail with its own minimum order quantity, which is what
makes the B2B tier in SRS §14 demonstrable rather than notional.

`Product.ratingAvg` is likewise an integer scaled ×10 — `45` renders as 4.5.

### 2.4 Every review is a verified purchase

The application will only accept a review for a product that appears on a
**delivered** sub-order belonging to that customer — checked against the order
tables, not passed in from the form — and `/account/reviews` builds its "ready
to review" list the same way. The homepage testimonials band says as much to
visitors.

The seeded reviews honour that rule rather than working around it: each one is
derived from a delivered order line, written by the customer who received that
parcel, and dated after it arrived. This is why the demo carries a few months of
trading history — the purchases have to exist before the opinions can. You can
check the whole claim in one command:

```bash
npx tsx prisma/seed-check.ts
```

It fails if any review has no delivered order behind it, if any is dated before
its own delivery, or if the same wording appears twice on one product.

Both demo customers deliberately keep **one delivered piece they have not
reviewed**, so `/account/reviews` opens with something for you to write rather
than an empty queue.

---

## 3. Public website

Start at `http://localhost:3000` signed out.

1. **Homepage** — hero carousel, category grid, featured products, new arrivals,
   best sellers, the six confidence blocks and customer testimonials. Every band
   is a query, not a hardcoded array, and every banner link resolves.

   Two worth looking at twice:

   - **Best sellers** is ranked by units *actually delivered*, and it is the
     same `salesCount` the listing page's "Best selling" sort uses — so the
     rail and the page behind its own link cannot disagree. A product with no
     deliveries scores zero and never appears.
   - **Testimonials** are real approved `Review` rows, shown with the customer
     who wrote them and the product they bought. Reject one in
     `/admin/reviews` and it leaves this band. There are no profile
     photographs, because the platform has never collected one — the card
     shows a monogram rather than a stock photo of someone who is not a
     customer.
2. **Mega-menu** — built from the 34-row category tree, not a hard-coded list.
3. **Listing** — open *Sarees*. Filter by fabric, pattern, occasion, work,
   colour, price and availability, and sort. Note the counts beside each option:
   they are computed per facet group, so ticking "Cotton" does not zero every
   other fabric. Every filter is a **link** — the URL is the state, so it is
   bookmarkable, shareable and works with JavaScript disabled.
4. **Product detail** — gallery, variant picker (changing the length changes the
   price *and* the stock line), seller identity, rating breakdown, related items.
5. **Search** — across product name, fabric, collection and seller.

Worth testing deliberately: **only approved products are public.** Seven seeded
products are draft, pending or rejected. Their slugs are guessable from their
names — try one, e.g. `/product/` plus a pending product's slug from Studio.
It 404s, and it is absent from search and every listing.

## 4. Customer journey

Sign in as `customer@saawariya.test` (retail) or `wholesale@saawariya.test`
(trade pricing and minimum order quantities).

**Both demo customers already have an open bag**, so you can start at `/cart`
rather than having to build one first. The retail bag holds three lines from
three different sellers; the wholesale bag holds two fabric lines, both above
their minimum order quantity.

1. **Add to bag** from a product page. The bag icon appears in the header only
   for a signed-in customer, because a cart belongs to an account.
2. **`/cart`** — lines are grouped **by seller**, which is how the order will
   actually be fulfilled and shipped. Change quantities, save for later, remove.
   The retail bag totals ₹14,380 across three parcels; the wholesale bag shows
   trade prices with the MOQ under each line.
3. **Coupons** — every outcome is reachable from the seeded baskets:
   - `VIVAAH15` **applies** on the retail bag (15% off, capped at ₹5,000).
   - `WELCOME10` is **refused** — it is for new customers, and this account has
     order history.
   - `FESTIVE500` is **refused** with "you have already used" — one per customer,
     and this account used its one.
   - `BULK20` **applies** on the wholesale bag, which clears its ₹50,000 minimum.
     Remove a line and try again: it is then rejected with the amount still
     needed, not a generic "invalid code".
4. **`/checkout`** — choose or add an address, pick a payment method, place the
   order.

   > **No payment gateway is connected.** This is stated on the checkout page
   > itself. Online methods record a successful payment with a deliberately
   > synthetic `SIM-…` reference so the finance and settlement screens have real
   > data. No card details are collected anywhere in this application.

5. **Confirmation** then **`/account/orders/<number>`** — a five-stage tracking
   rail per parcel, courier and tracking number, and the full event history.
6. **Cancel an order** and watch what it does: the reserved stock is released,
   a refund is raised as **PENDING for finance** rather than auto-approved, and
   the coupon use is returned to the customer.
7. **The rest of the panel** — address book, notifications, support requests,
   and settings including the retail → wholesale upgrade. Two of these arrive
   with work already in them rather than an empty state:
   - **Wishlist** — four saved pieces. "Move to bag" appears on the one without
     variants; the rest say "Choose options", because a size or length has to be
     picked before anything can go in a bag.
   - **Reviews** — five written, one of them still awaiting moderation so the
     customer's own view of that state is visible, plus one delivered piece
     **ready to review** so the form has something to attach to (§2.4).

Two things to try that show the rules are real rather than cosmetic:

- **Sign in as the wholesale account** and open a running-fabric product. Trade
  pricing applies, and the quantity stepper starts at that product's minimum
  order quantity — you cannot add fewer.
- **Open order `SAAW-2026-000008`.** It spans two sellers, so it is two parcels
  with independent statuses: one dispatched with a tracking number, one still
  being prepared. A single order status could not describe that, which is why
  the model splits `Order` from `SubOrder`.

### 4.1 Reviews are verified purchases, and moderated

`/account/reviews` offers only products that have actually been **delivered** to
that customer — the list is built from delivered order lines, so there is no
route to reviewing something you did not buy. A posted review is held as
`PENDING` and, importantly, **does not move the product's public rating** until
an admin approves it.

## 5. Seller journey

Sign in as `seller@saawariya.test` (Anil Textiles). Everything below is backed
by real rows — no screen in this panel is a mock-up.

### 5.1 The fulfilment model this build implements

The SRS describes two incompatible models: §61 has the seller packing and
marking "Ready for Pickup", §93–95 has a **platform warehouse** picking and
packing. This build implements **§93–95**, because the `SubOrder` status list,
`QcInspection` and the four operations roles were all modelled around it, and a
pure marketplace is a subset of it rather than the other way round.

So the seller's part of the pipeline is exactly two moves — **confirm** or
**decline** — and `CONFIRMED` is the handover point. Picking, quality control,
packing and dispatch belong to operations (Phase 7).

### 5.2 Confirming an order

`/seller/orders` opens on a **non-empty** "To confirm" queue, deliberately: it
is the panel's primary action and an empty queue cannot be evaluated.

Open one and confirm it. Four things happen in a single transaction:

- the sub-order moves `PLACED → CONFIRMED` and stamps `confirmedAt`,
- an `OrderEvent` records the seller, the from- and to-status and the note,
- the **parent order status is recomputed from its sub-orders** — a two-seller
  order with one parcel confirmed becomes `PROCESSING`, not `CONFIRMED`,
- the customer is notified.

Declining requires a written reason, and **releases the reserved stock** with an
`ORDER_CANCELLED` row on the ledger. Watch `reservedQty` fall on
`/seller/inventory`.

### 5.3 The buttons are computed, not hard-coded

Every control on an order comes from `availableTransitions()` in
`src/lib/order-state-machine.ts`, filtered by the permissions the signed-in role
actually holds. A seller is never shown "Start picking" because picking needs
`warehouse.process`. Posting the transition directly is refused for the same
reason — `assertTransition` re-checks on submit, since a button that is not
drawn is not a control.

### 5.4 Editing a live product sends it back for approval

`/seller/products` → open a **Live** product → change the price → save. Its
status becomes **In review**, the approval metadata is cleared, and the product
**disappears from the public storefront** until an admin re-approves it (try its
`/product/…` URL). Without that, a seller could pass review with a modest saree
and then rewrite it into something else at the same URL.

A seller can never approve their own product: `status` is never read from the
form, so a crafted POST carrying `APPROVED` does nothing.

### 5.5 Stock cannot go below what is already sold

On `/seller/inventory`, three numbers are shown per product and they mean
different things — **on hand**, **reserved** for orders already paid for, and
**available to buy**. Try to remove more than `stockQty − reservedQty`: it is
refused, and **no ledger row is written**. Allowing it would let a seller
"correct" their count into a position where the warehouse cannot fulfil orders
the customer has already been charged for.

Every accepted change appends to `StockMovement`, so a balance can always be
explained.

### 5.6 Settlements reconcile

`/seller/settlements` raises one settlement per **delivered** parcel.
Commission is charged on the sub-order's **gross** value, *before* any
Saawariya-funded coupon — which is why `SubOrder.discountAmount` is its own
column. A platform promotion does not come out of the seller's payout.

`/seller/reports` counts revenue only on delivered parcels, for the same reason
a dashboard figure should not fall when an order is cancelled; orders still in
fulfilment are reported separately.

### 5.7 An unapproved seller is gated, but not stranded

Sign in as `gupta.depot@saawariya.test` (rejected). You land on
`/seller/pending`, which shows the reviewer's reason and a **per-document** KYC
checklist rather than a bare status word. Every panel URL bounces back here.

"Edit business details" leads to `/seller/onboarding`, which is reachable
without approval by design — it is the page that would fix the problem.
Resubmitting a rejected application returns it to `PENDING` and clears the stale
reason, so a seller who corrects everything is actually looked at again.
Verification status and commission rate are not fields on that form and are
never written by its action.

## 6. Admin console

Sign in as `admin@saawariya.test`. The console is the other half of the seller
panel: three of the fields section 5 showed you being *read* are written here.

### 6.1 Product approval, and the URL that proves it

1. `/admin/products` opens on the **In review** queue — five products are waiting.
2. Before approving, open the product's public URL (`/product/<slug>`). It
   **404s**: only approved products are public.
3. Approve it, then reload that URL. It is **live at the same address**.
4. Now reject a different, live product and write a reason.

Two things to check afterwards:

- The rejected product 404s again.
- Sign in as `seller@saawariya.test` and open `/seller/products`. Your rejection
  reason is there, **word for word**. That is the point of forcing one — a
  rejection with no reason is a dead-end screen telling someone they failed and
  not why. The schema requires it; the form cannot skip it.

### 6.2 The KYC gate

`/admin/sellers` → **Bengal Loom House** (under review).

Try to approve them. It is **refused, and it names the outstanding documents**.
Approve the documents one at a time and watch the outstanding list shrink; the
seller becomes approvable only when all four are approved.

This is enforced server-side, not by disabling a button — because
`/seller/pending` promises the seller "you can sell as soon as all four documents
are approved", and approving around that would make that page a lie.

### 6.3 Suspending a seller withdraws their catalogue

Approve Bengal Loom House, publish one of their products, and confirm it is on
the storefront. Then **suspend the seller**. The confirmation tells you how many
live products were withdrawn, and the storefront no longer lists them — the
catalogue filters on the seller's verification status, so it is one write rather
than a batch job that might half-finish.

Reinstating restores them. The seller's own `User` stays active throughout,
deliberately: they keep the sign-in that reaches the page explaining why.

### 6.4 Moderation moves a public number

`/admin/reviews` has reviews awaiting moderation (`npx tsx prisma/seed-check.ts`
reports the exact count, which drifts as the seed grows). Publish a 4★ one and
watch the product's rating change — on the storefront and in the seller's own
catalogue. This is the other end of the check in section 4.1, where a *newly
posted* review deliberately did **not** move it.

### 6.5 An override the pipeline records honestly

`/admin/orders` → open a confirmed order → move it to **Warehouse queue**. That is
a `warehouse.process` move no seller can make; a super admin holds every
permission, so the state machine allows it with no special-case code.

Check the timeline afterwards: the actor is recorded as **the super admin**, not
as the warehouse. An override that disguised itself as the desk it bypassed would
be worse than no audit trail at all.

### 6.6 The screens that argue with you

- **`/admin/categories`** — try to make *Sarees* a sub-category. Refused: "Sarees
  has 6 sub-categories, so it cannot itself become one." The tree is two levels
  deep on purpose.
- **`/admin/settings`** — change `shipping.dispatch_days` to 4, then open any
  product page: it now reads "Dispatched within 4 working days". Checkout reads
  its shipping, GST, COD and returns rules from this table too, so this screen
  controls something real. Change it back.
- **`/admin/roles`** — read-only, and it says why on the page. It also runs a
  **drift check** between the seeded permission rows and the constants every
  check actually consults, which is a real defect nothing else would surface.
- **`/admin/inventory`** — read-only. No role holds "manage all stock": stock
  states what a seller physically has, and the ledger is append-only.
- **`/admin/audit`** — every mutation you just made, grouped by module, attributed
  to you. There is no delete control, because an audit trail an administrator can
  edit is not an audit trail.

---

## 7. The fulfilment pipeline

The end-to-end thread, and the part that distinguishes Saawariya from a generic
storefront. Four desks, four sign-ins, one parcel.

```
Seller confirms
  → Warehouse pulls in, picks
  → QC inspects against a 16-point checklist
      ├─ pass → packed → ready for dispatch
      └─ fail → returned to warehouse → re-picked → re-inspected
  → Logistics dispatches → in transit → out for delivery → delivered
  → Settlement raised for the seller
```

Every desk scopes by **where the parcel is**, not by who owns it — under the
platform-warehouse model every desk handles every seller's goods.

### 7.1 Warehouse — `warehouse@saawariya.test`

`/operations/warehouse/queue` has parcels in every state. Take one from
**Inbound**, pull it in, and pick it.

- The **pick list** (`/…/pick-list`) is printable and carries the customer's full
  delivery address — this is the desk that puts a parcel in a box.
- Try the shortage report: say you found fewer than the line quantity. Stock
  drops with a `QC_DAMAGED` or shortage row on the ledger, the seller is
  notified, and the parcel's timeline records it. Try to report **more** than the
  line: refused, and nothing is written.
- `/operations/warehouse/inventory` is platform-wide stock;
  `/operations/warehouse/movements` is the ledger behind it.

### 7.2 Quality control — `qc@saawariya.test`

Open the parcel you just picked.

- The checklist starts **unticked**, with a "Tick everything" button. Try to pass
  with anything unticked: refused, and it counts them for you. Pre-ticking would
  make a pass one click and turn the stored checklist into a record of sixteen
  checks nobody performed — which is the only reason the row exists.
- **Fail it** on a reason with a note. It goes back to the warehouse.
- Re-pick it as the warehouse, then pass it as QC. The row is flagged
  **re-inspection** automatically, because the earlier verdict still exists.
- `/operations/qc/reports` shows the pass rate and the rejection-reason
  breakdown, computed from those rows.

### 7.3 Logistics — `logistics@saawariya.test`

Dispatch the packed parcel with a courier and tracking number, then move it
through transit and delivery.

Two things worth doing deliberately:

- **Record a failed delivery attempt.** The *shipment* goes `DELIVERY_FAILED`
  with a reason; the **sub-order stays `OUT_FOR_DELIVERY`**, because the courier
  will re-attempt. The panel says so on the page. Inventing a sub-order state for
  it would tell the customer their parcel had gone backwards.
- **Watch stock on dispatch.** `reservedQty` is released *and* `stockQty` drops,
  with an `ORDER_DISPATCHED` ledger row — that is the moment the units physically
  leave. Cancelling releases the reservation without moving units; a return puts
  them back.

### 7.4 What to check when it lands

- The customer sees **five collapsed stages**, not the fourteen pipeline states.
  `QC_FAILED` shows as "Being prepared" — a customer does not need to know their
  saree failed inspection and was corrected.
- The seller sees the move on their own order screen, and still sees only the
  customer's **city and PIN**. They never ship the parcel, so the street address
  has no operational purpose and handing it over would be a privacy leak.
- Cross-desk gating: as the warehouse user, open a QC URL. The routing layer
  allows it and the page refuses it, exactly as in section 1.4.
- A QC user opening a *dispatched* parcel sees the record and **no buttons**. The
  controls come from `availableTransitions()`, so that needs no extra rule.

---

## 8. Finance, marketing and support

Three desks that sit outside the admin console. Each has its own sign-in, and a
super admin can work all three.

### 8.1 Finance — `finance@saawariya.test`

- **`/admin/finance/settlements`** — one settlement per delivered parcel.
  Commission is charged on the **gross** value, before any platform-funded
  coupon, and the arithmetic on screen reconciles per seller (Anil Textiles at
  10%, Meenakshi Silks at 12%, Chanderi Handloom Collective at 8%).
  - **Release** a payout with a reference. The seller is notified and the audit
    row is attributed to finance.
  - **Hold** one. It is refused without a note — and the note you write appears
    **verbatim on the seller's own payouts screen**. Check it as the seller.
  - A settlement whose parcel is not delivered yet **cannot** be released, and
    the screen states the rule rather than hiding the button. The precondition is
    a fact about another row, so it cannot live in the transition table.
- **`/admin/finance/refunds`** — `PENDING → APPROVED → PROCESSED`. Approving and
  paying are separate states because "agreed but not yet sent" is where a refund
  spends most of its life, and is exactly what a customer chasing their money is
  asking about. The `Payment` becomes `REFUNDED` only if the **whole** amount came
  back.
- **`/admin/finance/payments`** — the transaction log, and it is **read-only**.
  `payment.view` is the only payment permission in the entire matrix: a payment
  row records what a gateway did, and "mark as paid" would record a fiction.

### 8.2 Marketing — `marketing@saawariya.test`

- **`/admin/marketing/banners`** — switch a `HOME_HERO` banner off and reload the
  homepage. It is gone. Switch it back on; it returns. The list is grouped by slot
  in sort order because that *is* the carousel.
- **`/admin/marketing/coupons`** — each row's state is derived from the same three
  conditions the cart applies, so a code marketing believes is live and the cart
  is rejecting shows here as expired rather than as a mystery. Open one to see
  what it has actually done — the orders beneath the form are the point.
- **`/admin/marketing/audience`** — broadcast to "Wholesale accounts". The
  confirmation is **typed, not ticked**, and the count is re-derived on the
  server: type the wrong number and it is refused. Sending writes real
  `Notification` rows to exactly those users, and the campaign's reach moves by
  exactly that many — reach is a row count, never an assertion.
- **`/admin/marketing/content`** — the CMS. The slug is not editable and a linked
  page cannot be unpublished, because the footer, the login page and seeded
  banners point at those slugs. This is the one screen that could create seven
  dead links in a click.

### 8.3 Support — `support@saawariya.test`

- **`/admin/support/tickets`** — seven tickets across every state, including a
  critical unassigned one. Assign one, add an **internal note**, then resolve it.
  - Resolving is refused without an explanation.
  - Open the same ticket as the customer (`/account/support/<number>`): your reply
    is there and the **internal note is not**. It is filtered out in the query,
    not hidden in the component.
- **`/admin/support/returns`** — five returns spanning the whole workflow. Complete
  one and watch a single transaction do all of it: the sub-order moves to
  `RETURNED`, stock goes back up with a `RETURN_RESTOCK` ledger row, the parent
  order is recomputed, an `OrderEvent` is written with the support agent as actor,
  a refund is raised **PENDING on the finance queue**, and the customer is
  notified.
  - A return is deliberately **two rows**: `ReturnRequest.status` is the desk's
    decision, `SubOrder.status` is where the parcel physically is. Approving does
    not move goods, so "Complete and refund" only appears once the parcel is
    actually back.

### 8.4 Desk isolation

Sign in as finance and open `/admin/marketing/coupons` — you land back on
`/admin/finance`. Each desk is gated on the permission, not the role, which is
what lets a super admin work all three without a special case.

---

## 9. Checking the whole thing yourself

Three commands, none of which require reading the code.

```bash
npm run qa
```

Signs in as every demo account, crawls every screen reachable from their
navigation, and asserts: every page returns 200, no browser console errors, no
horizontal scroll at 375px, every wrong-role URL redirects, and every route in
the application was actually reached. It writes
**[QA_REPORT.md](QA_REPORT.md)**. It only follows links, so it cannot change
your data.

```bash
npx tsx prisma/seed-check.ts
```

Asserts the invariants instead of asking you to spot them — order totals
reconcile to the paise, derived columns agree with their sources, no operations
queue is empty, no failed inspection lacks a reason, every dispatched parcel has
a shipment with events.

```bash
npm run srs:coverage
```

Regenerates **[SRS_COVERAGE.md](SRS_COVERAGE.md)** — all 202 SRS sections and
where each is answered, read out of the citations in the code itself. Three
sections are **not built** and are named there rather than left to be found.
