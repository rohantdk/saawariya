# Deploying the demo

How to put this build on a URL the client can open, without changing what the
project is.

> **Read [the imagery note](#before-you-make-it-public) first.** A public URL is
> what makes the site public, and there is one unresolved question about the
> imagery that should be settled — or worked around — before that happens.

---

## The short version

Railway, one service, one small volume, SQLite unchanged. Roughly fifteen minutes.

| | |
| --- | --- |
| Host | [Railway](https://railway.app) — or any host that offers a persistent disk |
| Database | SQLite, on a mounted volume |
| Instances | **exactly one** (see [why](#why-one-instance)) |
| Cost | around $5/month for the volume and a small instance |

---

## Why not Vercel

The project stores its data in a SQLite **file**. Vercel and other serverless
platforms give each invocation a fresh, throwaway filesystem, so writes either
vanish or are invisible to the next request. Every write the demo exists to show
— placing an order, confirming it, passing QC — would appear to work and then be
gone.

That is a hosting-model mismatch, not a defect, and there are two honest answers:

1. **A host with a persistent disk.** No code changes. This document.
2. **Move to PostgreSQL.** The correct answer for production, and the schema was
   written for it — no native enums, no scalar lists, no `Decimal`, so it is
   valid PostgreSQL as written and no query code changes. It needs the provider
   changed in `prisma/schema.prisma`, the adapter swapped in `src/lib/prisma.ts`,
   `prisma/seed.ts` and `prisma/seed-check.ts`, and the migrations regenerated —
   the SQLite ones do not port.

For a demo, take route 1. Route 2 is a production step, worth doing when real
sellers are onboarded rather than on the day the demo ships.

---

## Steps

### 1. Create the service

Point a new Railway project at this repository. `railway.json` is already here,
so the build and start commands are picked up automatically:

```
build:  npx prisma generate && npm run build
start:  node scripts/deploy-start.mjs
```

### 2. Add a volume

Mount it at **`/data`**. This is the part that makes the demo durable — without
it the database is inside the container and is destroyed on every redeploy.

### 3. Set the variables

| Variable | Value | Why |
| --- | --- | --- |
| `DATABASE_URL` | `file:/data/saawariya.db` | On the volume. **Must be an absolute path.** |
| `SESSION_SECRET` | output of `openssl rand -base64 32` | Signs session cookies. Never reuse the development value. |
| `DEMO_PASSWORD` | something you choose | Puts the whole site behind a password. See below. |
| `NEXT_PUBLIC_APP_URL` | the Railway URL | Used for canonical links and `sitemap.xml`. |
| `SEED_DEMO_PASSWORD` | `Saawariya@123` | The password for the eleven demo accounts. Change it if the URL is shared widely. |

`PORT` is set by Railway; nothing to do.

### 4. Deploy

On first boot `scripts/deploy-start.mjs` applies the migrations, seeds the demo
data, and writes a marker to `/data` so it never re-seeds over the client's work.
Watch the logs for:

```
[boot] ✓ migrations applied
[boot] first boot on this volume — seeding demo data
[boot] ✓ demo data seeded
[boot] starting Next.js on port 8080
```

---

## The password gate

Setting `DEMO_PASSWORD` turns on HTTP Basic Auth in front of **every page and
every image**, and marks the site `noindex, nofollow`. It is read per request,
so setting it on a running service takes effect without a rebuild. The browser shows a
standard sign-in box; the username is ignored, only the password is checked.

Send the client the URL and the password. Nothing else changes — the eleven demo
logins work exactly as they do locally, and the walkthrough still applies.

Leave `DEMO_PASSWORD` unset and the gate does not exist. Local development and
the delivered project are unaffected, which is why this can ship switched off.

**It is a curtain, not a security boundary.** One shared password, sent on every
request, in front of demo data. The real authorisation story is unchanged and
lives in `src/lib/auth/dal.ts` and the per-action checks.

---

## Before you make it public

`public/editorial/CREDITS.md` and `public/catalogue/CREDITS.md` record that two
sets of images are not cleared:

- **Twelve frames from the client's own prototype** — of undocumented origin, no
  stated licence, several depicting identifiable-looking people. Five sit on live
  product pages.
- **Thirty client-supplied photographs** with no stated commercial usage rights.

Putting the site on an open URL is the exposure those notes are about — not the
eventual launch. Three ways through, cheapest first:

1. **Set `DEMO_PASSWORD`.** The client reviews the complete build; nobody else
   reaches it. Recommended.
2. **Revert the five product frames** to the CC0 museum photography, which was
   never deleted. `public/catalogue/CREDITS.md` says exactly how.
3. **Settle the rights** with Team ARJITAY, then deploy openly.

---

## Why one instance

A SQLite file cannot be shared by two processes on different machines. Scaling
to two replicas gives each its own copy of `/data` — two diverging databases
behind one URL, which looks like data randomly disappearing.

`railway.json` pins `numReplicas: 1`. Leave it there. Needing more than one
instance is the signal that it is time for PostgreSQL.

---

## Resetting the demo

Visitors can change the seeded data — that is the point. To put it back:

```bash
railway run npm run db:seed
```

Or delete `/data/.saawariya-seeded` and redeploy, which re-seeds on the next boot.

---

## Local check before deploying

The gate and the boot script can both be exercised on your own machine:

```bash
DEMO_PASSWORD=letmein npm run build && DEMO_PASSWORD=letmein npm start
```

Every request should return `401` until you sign in with any username and
`letmein`. Unset the variable and the site behaves normally again.
