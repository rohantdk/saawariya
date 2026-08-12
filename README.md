# Saawariya

Enterprise multi-vendor textile marketplace — B2C retail and B2B wholesale, with
seller onboarding, product approval, and a quality-controlled fulfilment pipeline.

Built for Team ARJITAY against the supplied Software Requirement Specification
(SRS v1.0) and Project Brief v1.0.

---

## Running the project

### Prerequisites

**Node.js 20.9 or newer** — that is the only thing you need to install.
Check yours with `node --version`. If it is older, get the current LTS from
[nodejs.org](https://nodejs.org).

There is **no database server to install**. No Docker, no PostgreSQL, no MySQL.

### Setup

```bash
npm install
```

```bash
npm run setup
```

```bash
npm run dev
```

Then open **http://localhost:3000**.

`npm run setup` creates your `.env`, generates the database client, applies
migrations and seeds demo data. It is safe to re-run at any time.

---

## Demo accounts

Every account uses the password **`Saawariya@123`**.

| Role | Email | Lands on |
| --- | --- | --- |
| Customer (retail) | `customer@saawariya.test` | `/account` |
| Customer (wholesale) | `wholesale@saawariya.test` | `/account` |
| Seller | `seller@saawariya.test` | `/seller` |
| Warehouse | `warehouse@saawariya.test` | `/operations/warehouse` |
| Quality Control | `qc@saawariya.test` | `/operations/qc` |
| Logistics | `logistics@saawariya.test` | `/operations/logistics` |
| Finance | `finance@saawariya.test` | `/admin/finance` |
| Customer Support | `support@saawariya.test` | `/admin/support` |
| Marketing | `marketing@saawariya.test` | `/admin/marketing` |
| Super Admin | `admin@saawariya.test` | `/admin` |

One extra account is worth knowing about: **`gupta.depot@saawariya.test`** is a
seller whose application was **rejected**. Signing in as them lands on
`/seller/pending`, which shows the reviewer's reason and a per-document KYC
checklist — the gated-but-not-stranded path described in the walkthrough.

See **[docs/DEMO_WALKTHROUGH.md](docs/DEMO_WALKTHROUGH.md)** for a guided click-path
through the platform — it is written so the parts that matter are seen in the
right order, rather than found by clicking around.

`docs/screenshots/index.html` is a contact sheet of every screen, if you would
rather look before you install anything.

---

## Technology

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19, TypeScript) |
| Styling | Tailwind CSS v4, design tokens from the Saawariya brand palette |
| Database | SQLite via Prisma 7 — **PostgreSQL-ready**, see below |
| Authentication | Signed JWT session in an httpOnly cookie (`jose`), bcrypt password hashing |
| Authorisation | Role-Based Access Control, 9 roles, 45 permissions |
| Validation | Zod 4, enforced server-side |

### Why SQLite locally

The SRS calls for a scalable, production-ready architecture (§181), and this
project must also run on a reviewer's machine without setup friction. Both are
satisfied at once:

- The Prisma schema deliberately avoids anything SQLite-specific — no native
  enums, no scalar list fields, no `Decimal`. It is valid PostgreSQL as written.
- Money is stored as **integer paise** throughout, never floats, so order totals,
  commission splits and settlements always reconcile exactly.
- Moving to PostgreSQL is a provider change in `prisma/schema.prisma`, a
  `DATABASE_URL` change, and swapping the driver adapter in `src/lib/prisma.ts`.
  No query code changes.

---

## Available commands

| Command | Does |
| --- | --- |
| `npm run setup` | Full first-time setup (env, client, migrations, seed) |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check, no emit |
| `npm run lint` | ESLint |
| `npm run qa` | End-to-end QA sweep across every role — see below |
| `npm run srs:coverage` | Regenerate the SRS coverage map |
| `npm run screenshots` | Capture every screen to `docs/screenshots/` |
| `npm run db:seed` | Re-seed demo data |
| `npm run db:reset` | Drop, re-migrate and re-seed the database |
| `npm run db:studio` | Browse the database in Prisma Studio |

---

## Checking the build

Three commands verify the platform without reading any of its code. The first two
need `npm run dev` running in another terminal.

```bash
npm run qa
```

Signs in as all eleven demo accounts, crawls every screen reachable from each
one's navigation, and asserts that every page returns 200, no browser console
errors or uncaught exceptions are raised, nothing scrolls horizontally at 375px,
every wrong-role URL redirects the user back to their own area, and every route
in the application was actually reached by a link. Results are written to
**[docs/QA_REPORT.md](docs/QA_REPORT.md)**. The sweep only follows links — it
never clicks a button or submits a form — so a run cannot alter your data.

> A full sweep is around 600 page loads driving a real browser, so give it a
> couple of spare gigabytes. On a busy machine, run one persona at a time with
> `ONLY=admin npm run qa`, or point it at a production build
> (`npm run build && npm start`) — that is both faster and lighter than the dev
> server. If the server stops responding mid-sweep the run stops immediately and
> says so, rather than reporting every remaining page as broken.

```bash
npx tsx prisma/seed-check.ts
```

Asserts the data invariants rather than asking you to spot them: order totals
reconcile to the paise, every derived column agrees with what it is derived from,
no operations queue is empty, no failed inspection lacks a reason, every
dispatched parcel has a shipment with a scan history, and campaign reach equals
the notifications behind it.

```bash
npm run srs:coverage
```

Regenerates **[docs/SRS_COVERAGE.md](docs/SRS_COVERAGE.md)** — all 202 sections of
the SRS and where each is answered. The map is read out of the codebase: modules
name the sections they implement in their doc comments, so the document cannot
claim a screen that has been deleted.

---

## What is not built

Stated here rather than left to be discovered. The full section-by-section
position is in [docs/SRS_COVERAGE.md](docs/SRS_COVERAGE.md).

| | Why |
| --- | --- |
| **No payment gateway** (§26, §175) | Online methods record a synthetic `SIM-…` reference. No card details are collected anywhere. The checkout page says so |
| **No email, SMS or WhatsApp delivery** (§177) | Notifications are real rows, shown in-app. Delivery channels need integrations that are not connected |
| **No courier API** (§175) | Tracking numbers and scan events are recorded by the logistics desk, not fetched |
| **No REST or GraphQL API** (§174) | Writes are Server Actions, reads are server components. There is no public API surface, so there was none to design |
| **Campaign clicks and conversions** (§129) | The columns exist because the SRS specifies them, and stay at zero. There is no analytics pipeline, and inventing numbers would be worse than showing none |

Everything else in the SRS has a real screen behind it, backed by real data. The
rule this build held to throughout: **no dead links and no fake screens.**

---

## Project structure

```
saawariya/
├── prisma/
│   ├── schema.prisma        # 33 models — the full domain
│   ├── migrations/          # version-controlled schema history
│   ├── seed.ts              # seed entry point
│   └── seed/                # seed modules, one per domain area
├── public/
│   └── catalogue/           # product photography (committed) + CREDITS.md
├── scripts/
│   ├── setup.mjs            # cross-platform one-command setup
│   ├── qa.mjs               # end-to-end QA sweep across every role
│   ├── srs-coverage.mjs     # builds the SRS coverage map from code citations
│   ├── screenshots.mjs      # captures every screen for the hand-over
│   ├── catalogue-images.json      # image manifest: source, page, licence
│   └── fetch-catalogue-images.mjs # dev tool — regenerates the images above
├── src/
│   ├── app/
│   │   ├── (auth)/          # login, register, password recovery
│   │   ├── account/         # customer panel
│   │   ├── seller/          # seller panel
│   │   ├── admin/           # admin, finance, support, marketing
│   │   ├── operations/      # warehouse, QC, logistics
│   │   └── actions/         # Server Actions
│   ├── components/
│   │   ├── brand/           # wordmark
│   │   ├── layout/          # shared panel chrome
│   │   └── ui/              # form and button primitives
│   ├── lib/
│   │   ├── auth/            # session, password, permissions, DAL
│   │   ├── catalogue/       # storefront reads, filters, pricing
│   │   ├── commerce/        # cart, totals, coupons, order placement
│   │   ├── seller/          # seller panel reads
│   │   ├── admin/           # admin console reads + the audit helper
│   │   ├── operations/      # warehouse, QC and logistics queues
│   │   ├── fulfilment/      # performing a transition; the order roll-up
│   │   ├── finance/         # settlements, refunds, payments
│   │   ├── marketing/       # coupons, banners, campaigns, CMS
│   │   ├── support/         # tickets and returns
│   │   ├── validations/     # Zod schemas
│   │   ├── order-state-machine.ts  # which pipeline moves are legal, for whom
│   │   ├── constants.ts     # domain constants (statuses, roles, facets)
│   │   ├── prisma.ts        # database client singleton
│   │   └── utils.ts         # money, dates, formatting
│   └── proxy.ts             # route gating (Next.js 16 renamed Middleware → Proxy)
└── docs/
    ├── DEMO_WALKTHROUGH.md  # guided click-path through the whole platform
    ├── SRS_COVERAGE.md      # all 202 SRS sections and where each is answered
    ├── DATA_MODEL.md        # why the schema looks the way it does
    ├── ERD.md               # entity relationship diagrams
    ├── ROLES.md             # why nine role codes and not eleven
    ├── QA_REPORT.md         # output of the last `npm run qa`
    └── screenshots/         # every screen, plus an index.html contact sheet
```

**Where the rules live.** Two modules are worth knowing before changing anything
in the order pipeline. `src/lib/order-state-machine.ts` is pure and answers only
"is this move legal, and does this permission set allow it".
`src/lib/fulfilment/transition.ts` *performs* the move — status, timestamp,
event, stock effect, parent-order recompute and customer notification — in one
transaction. Neither checks ownership: scoping to a seller is a `where` clause at
the call site, so the same two modules serve the seller panel, the admin
override and all three operations desks.

---

## Catalogue imagery

Product photography lives in `public/catalogue/` and is **committed to the
repository**, not fetched at setup — this project is reviewed by unzipping and
running it locally, and a demo that needs internet access to render its own
product images is a demo that breaks during the review it exists for.

Every image is **public domain or CC0**, sourced from Wikimedia Commons. Most are
photographs of museum textile holdings (the Metropolitan Museum of Art, the
Cleveland Museum of Art, LACMA, the Honolulu Museum of Art and Cooper Hewitt),
which is why they are shot flat against neutral grounds. Neither licence requires
attribution; **[public/catalogue/CREDITS.md](public/catalogue/CREDITS.md)** lists
the source file, Commons page and licence for every image anyway, so the
licensing can be verified rather than taken on trust.

These are illustrative demo assets. They are matched to product *type* — a
Banarasi listing gets a Varanasi brocade — but they are not photographs of the
specific fictional products in the seed data.

`scripts/catalogue-images.json` is the manifest, and
`node scripts/fetch-catalogue-images.mjs` regenerates the images, the credits
file and `prisma/seed/images.ts` from it. Running it is not part of setup.

---

## Security notes

Authorisation is enforced in three independent places, because any one of them
alone is insufficient:

1. **`src/proxy.ts`** — optimistic route gating. Reads the signed cookie only,
   never the database, because it runs on every request including prefetches.
2. **`src/lib/auth/dal.ts`** — the authoritative check. Re-validates the session
   against the database on every protected read, so a user suspended mid-session
   loses access on their next request rather than when their cookie expires.
3. **Every Server Action** — re-checks independently, because actions are
   reachable directly regardless of what the routing layer permitted.

Other measures: passwords hashed with bcrypt (cost 12) and never selected by the
DAL; failed logins recorded with IP and user agent; login responses deliberately
identical for unknown-email and wrong-password, with a dummy hash comparison so
the two also take similar time; `next=` redirect targets restricted to internal
paths to prevent the login page being used as an open redirect.

---

© 2026 Team ARJITAY. Prepared as a demo project — see the confidentiality notice
in the supplied SRS.
