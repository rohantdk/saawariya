# Roles and access control

SRS §16 defines eleven role subsections. This document maps each one onto the
implementation, because the count deliberately does not match: the system has
**nine authenticated roles**, and the remaining two SRS entries are modelled as
something other than a role, for the reasons given below.

## Mapping

| SRS | Implemented as | Notes |
| --- | --- | --- |
| §16.1 Visitor | *No role* — absence of a session | See below |
| §16.2 Customer | `CUSTOMER` | |
| §16.3 Wholesale Customer | `CUSTOMER` + `Customer.customerType = WHOLESALE` | See below |
| §16.4 Seller | `SELLER` | |
| §16.5 Warehouse Team | `WAREHOUSE` | |
| §16.6 Quality Control Team | `QC` | |
| §16.7 Logistics Team | `LOGISTICS` | |
| §16.8 Finance Team | `FINANCE` | |
| §16.9 Customer Support Team | `SUPPORT` | |
| §16.10 Marketing Team | `MARKETING` | |
| §16.11 Super Administrator | `SUPER_ADMIN` | |

## Why Visitor is not a role

A Visitor has no account and no credentials. Access control answers "what may
this authenticated principal do"; a Visitor is the absence of a principal.

Creating a `Role` row for Visitor would imply that visitors can be assigned,
granted permissions, suspended, or signed in as — none of which is meaningful.
Instead, visitor capability is defined by what requires no session at all: the
public site, catalogue browsing, search and product detail are simply outside the
protected areas listed in `src/proxy.ts`.

SRS §16.1's restriction — "cannot place orders without authentication" — is
therefore enforced structurally rather than by a permission check.

## Why Wholesale Customer is a tier, not a role

Retail and wholesale customers hold **identical permissions**: browse, cart,
wishlist, checkout, view own orders, review, raise tickets. Nothing a wholesale
buyer may *do* differs from what a retail buyer may do.

What differs is data:

- **Pricing** — wholesale buyers see `Product.priceWholesale` rather than
  `priceRetail`; the tier actually charged is snapshotted onto every
  `OrderItem.priceTier` so historic orders stay correct.
- **Minimum order quantity** — `Product.minOrderQty` is enforced for wholesale.
- **GST** — required at registration for wholesale accounts, and validated
  server-side in `src/lib/validations/auth.ts`.

Modelling this as a separate role would duplicate the entire customer permission
set, and every future customer permission would have to be granted twice and kept
in sync. A divergence between the two copies would be a silent authorisation bug.
A single role with a type discriminator has one source of truth.

## Where authorisation is enforced

Three independent layers. Each is necessary; none is sufficient alone.

1. **`src/proxy.ts`** — optimistic route gating. Verifies the session cookie's
   signature only, never touching the database, because it runs on every request
   including prefetches.
2. **`src/lib/auth/dal.ts`** — the authoritative boundary. Re-validates against
   the database on every protected read, so a user suspended mid-session loses
   access on their next request rather than whenever their cookie expires.
3. **Every Server Action** — checks independently, because Server Actions and
   Route Handlers are reachable directly regardless of what routing permitted.

To see layers 1 and 2 disagree deliberately, sign in as
`warehouse@saawariya.test` and visit `/operations/qc`: the proxy allows it
(Warehouse is an operations role), and the page still refuses.

## Permission matrix

Defined in `src/lib/auth/permissions.ts` — 45 permissions across 9 roles. That
file is the source of truth; the `Role`, `Permission` and `RolePermission` tables
are seeded from it so the admin Roles & Permissions screen (SRS §88) reads real
data. A permission the code does not define cannot be granted by editing a row.
