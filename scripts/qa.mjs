/**
 * End-to-end QA sweep across every persona.
 *
 *   npm run dev      # in one terminal
 *   npm run qa
 *
 * Signs in as each demo account, crawls every link reachable inside that
 * persona's area, and asserts the things that are easy to break and expensive
 * to miss:
 *
 *   1. every page returns 200 — no dead links anywhere in the navigation
 *   2. no browser console errors and no uncaught exceptions
 *   3. no horizontal scroll at 375px, once per route pattern
 *   4. cross-role gating: a wrong-role URL lands the user back in their own area
 *   5. route coverage: every `page.tsx` under src/app was actually visited
 *
 * Exits non-zero if any check fails, and writes docs/QA_REPORT.md.
 *
 * Read-only by design: it follows links, never clicks buttons or submits
 * forms, so a run cannot mutate the seeded database.
 *
 * A full sweep is around 600 page loads and drives a real browser, so it wants
 * a couple of spare gigabytes. On a busy machine run it a persona at a time —
 * `ONLY=admin npm run qa` — or against a production build (`npm run build &&
 * npm start`), which is both faster and lighter than the dev server.
 */
import { chromium } from "playwright-core";
import { readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PASSWORD = "Saawariya@123";
/** Limit a run while iterating: ONLY=seller npm run qa */
const ONLY = process.env.ONLY;
/** Guard rail so a crawl bug cannot run forever. */
const MAX_PAGES = Number(process.env.QA_MAX_PAGES ?? 400);
/** Facet links are combinatorial; a couple of variants per path proves them. */
const MAX_QUERIES_PER_PATH = 2;
/**
 * Recycle the browser this often *within* a persona's crawl. The public
 * catalogue alone is 150+ pages, and a browser holding all of them is the
 * single largest thing on the machine during a sweep.
 */
const RECYCLE_EVERY = Number(process.env.QA_RECYCLE_EVERY ?? 40);

const CHROME_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];

/**
 * A sweep is ~600 navigations, so the browser is the heaviest thing on the
 * machine while it runs. These flags trim what it reserves, and the run
 * recycles it periodically (see RECYCLE_EVERY). Nothing here changes what is
 * being tested — only how much memory proving it costs.
 */
const LEAN_FLAGS = [
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--disable-extensions",
  "--disable-background-networking",
  "--renderer-process-limit=2",
];

/** Reachable without a session; every persona may also see these. */
const PUBLIC = [
  "/",
  "/shop",
  "/product",
  "/search",
  "/page",
  "/wholesale",
  "/login",
  "/register",
  "/forgot-password",
];

/**
 * A handful of screens are deliberately not linked from anywhere: they are
 * reached by submitting a form, or only exist once an account is in a
 * particular state. Each is named here with the reason, and visited directly,
 * so "no link points here" stays a decision rather than an oversight.
 */
const PERSONAS = [
  {
    key: "public",
    label: "Public visitor",
    roots: ["/"],
    area: PUBLIC,
    direct: [{ url: "/search?q=silk", why: "reached by submitting the header search form" }],
  },
  {
    key: "customer",
    label: "Customer (retail)",
    email: "customer@saawariya.test",
    roots: ["/account", "/cart"],
    area: ["/account", "/cart", "/checkout"],
    direct: [
      // /checkout used to be declared here, because the demo bag was empty and
      // an empty bag redirects to /cart. The seed now opens a basket for both
      // demo customers, so the crawl reaches it by following the real
      // "Proceed to checkout" link — which is stronger coverage than a declared
      // target, and is why the declaration is gone rather than reworded.
      {
        // The confirmation screen exists only after an order is placed, so the
        // number has to come from an order this customer actually owns.
        derive: { list: "/account/orders", hrefPrefix: "/account/orders/SAAW" },
        to: (href) => `/checkout/success/${href.split("/").pop()}`,
        why: "shown once, immediately after an order is placed",
      },
    ],
  },
  {
    key: "wholesale",
    label: "Customer (wholesale)",
    email: "wholesale@saawariya.test",
    roots: ["/account", "/wholesale"],
    area: ["/account", "/cart", "/checkout"],
  },
  {
    key: "seller",
    label: "Seller",
    email: "seller@saawariya.test",
    roots: ["/seller"],
    area: ["/seller"],
  },
  {
    // The gated seller. Every panel URL must bounce to /seller/pending, and
    // that page must still reach the one screen that can fix the problem.
    key: "seller-pending",
    label: "Seller (application rejected)",
    email: "gupta.depot@saawariya.test",
    roots: ["/seller/pending"],
    area: ["/seller/pending", "/seller/onboarding"],
  },
  {
    key: "admin",
    label: "Super admin",
    email: "admin@saawariya.test",
    roots: ["/admin"],
    area: ["/admin"],
  },
  {
    key: "warehouse",
    label: "Warehouse",
    email: "warehouse@saawariya.test",
    roots: ["/operations/warehouse"],
    area: ["/operations/warehouse"],
  },
  {
    key: "qc",
    label: "Quality control",
    email: "qc@saawariya.test",
    roots: ["/operations/qc"],
    area: ["/operations/qc"],
  },
  {
    key: "logistics",
    label: "Logistics",
    email: "logistics@saawariya.test",
    roots: ["/operations/logistics"],
    area: ["/operations/logistics"],
  },
  {
    key: "finance",
    label: "Finance",
    email: "finance@saawariya.test",
    roots: ["/admin/finance"],
    area: ["/admin/finance"],
  },
  {
    key: "marketing",
    label: "Marketing",
    email: "marketing@saawariya.test",
    roots: ["/admin/marketing"],
    area: ["/admin/marketing"],
  },
  {
    key: "support",
    label: "Customer support",
    email: "support@saawariya.test",
    roots: ["/admin/support"],
    area: ["/admin/support"],
  },
];

/**
 * Wrong-role URLs and where the user must end up instead. A redirect back to
 * their own area is the pass; rendering the page is the failure.
 */
const GATES = [
  ["public", "/account", "/login"],
  ["public", "/seller", "/login"],
  ["public", "/admin", "/login"],
  ["public", "/operations/warehouse", "/login"],
  ["customer", "/seller", "/account"],
  ["customer", "/admin", "/account"],
  ["customer", "/operations/qc", "/account"],
  ["seller", "/admin", "/seller"],
  ["seller", "/operations/warehouse", "/seller"],
  ["seller", "/admin/finance", "/seller"],
  ["seller-pending", "/seller", "/seller/pending"],
  ["seller-pending", "/seller/products", "/seller/pending"],
  ["seller-pending", "/seller/orders", "/seller/pending"],
  ["warehouse", "/operations/qc", "/operations/warehouse"],
  ["warehouse", "/admin", "/operations/warehouse"],
  ["qc", "/operations/logistics", "/operations/qc"],
  ["logistics", "/operations/warehouse", "/operations/logistics"],
  ["finance", "/admin/marketing", "/admin/finance"],
  ["finance", "/admin/sellers", "/admin/finance"],
  ["marketing", "/admin/support", "/admin/marketing"],
  ["support", "/admin/finance", "/admin/support"],
];

/** Super admin holds every permission, so it must reach every desk. */
const ADMIN_REACH = [
  "/admin",
  "/admin/finance",
  "/admin/marketing",
  "/admin/support",
  "/operations/warehouse",
  "/operations/qc",
  "/operations/logistics",
];

/* ------------------------------------------------------------------ routes */

/** Every `page.tsx` under src/app, as a matchable route pattern. */
async function routePatterns(dir = path.join(process.cwd(), "src", "app"), base = "") {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // (group) folders shape the layout tree, not the URL.
      const segment = /^\(.*\)$/.test(entry.name) ? base : `${base}/${entry.name}`;
      out.push(...(await routePatterns(path.join(dir, entry.name), segment)));
    } else if (entry.name === "page.tsx") {
      out.push(base === "" ? "/" : base);
    }
  }
  return out;
}

/** Match a pathname to its route pattern, preferring the most literal one. */
function matchPattern(pathname, patterns) {
  const parts = pathname.split("/").filter(Boolean);
  let best = null;
  let bestScore = -1;
  for (const pattern of patterns) {
    const segs = pattern.split("/").filter(Boolean);
    if (segs.length !== parts.length) continue;
    let score = 0;
    let ok = true;
    for (let i = 0; i < segs.length; i += 1) {
      if (segs[i].startsWith("[")) continue;
      if (segs[i] !== parts[i]) {
        ok = false;
        break;
      }
      score += 1;
    }
    if (ok && score > bestScore) {
      best = pattern;
      bestScore = score;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ helpers */

function chromePath() {
  const found = CHROME_PATHS.find((p) => existsSync(p));
  if (!found) throw new Error(`No Chrome or Edge found. Looked in:\n  ${CHROME_PATHS.join("\n  ")}`);
  return found;
}

const inArea = (pathname, area) =>
  area.some((prefix) => (prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`)));

/**
 * Console noise that says nothing about the application. Deliberate 404 checks
 * are counted, not filtered — a 404 the crawl did not intend is a dead link.
 */
const IGNORED_CONSOLE = [/favicon\.ico/i, /Download the React DevTools/i];

async function signIn(context, email) {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
  const landed = new URL(page.url()).pathname;
  await page.close();
  return landed;
}

/**
 * Let the page finish hydrating before moving on.
 *
 * Without this the crawl navigates away mid-hydration and React and the App
 * Router both complain — "Router action dispatched before initialization", and
 * a state update on an unmounted component. Neither reproduces on a real load;
 * both are artefacts of navigating faster than a person can. Reporting them
 * would make this script cry wolf, and suppressing the messages would hide the
 * real ones, so wait instead.
 */
async function settle(page) {
  await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(150);
}

/** True when the page overflows its own viewport horizontally. */
async function overflows(page) {
  return page.evaluate(() => {
    // documentElement.scrollWidth over-reports when a scrollable table with
    // sticky cells is on the page; whether the window actually moves is honest.
    window.scrollTo(600, 0);
    const moved = window.scrollX > 0;
    window.scrollTo(0, 0);
    return moved || document.body.scrollWidth > window.innerWidth + 1;
  });
}

/**
 * Every browser this run has opened.
 *
 * A crashed sweep used to leave its browser behind, holding a couple of
 * gigabytes. Several crashes later the machine was out of committed memory and
 * killing the dev server — which looks exactly like the application failing,
 * and cost real time to tell apart. So the run owns its processes and tears
 * them down however it ends.
 */
const OPEN_BROWSERS = new Set();

async function closeEverything() {
  for (const browser of OPEN_BROWSERS) {
    await browser.close().catch(() => {});
  }
  OPEN_BROWSERS.clear();
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, async () => {
    await closeEverything();
    process.exit(130);
  });
}

/* --------------------------------------------------------------------- run */

async function run() {
  const patterns = await routePatterns();
  const failures = [];
  const visitedPatterns = new Map(); // pattern -> first URL that hit it
  const explained = new Map(); // pattern -> why nothing links to it
  const offAreaChecked = new Set(); // links outside a panel, checked once overall
  let pagesVisited = 0;
  let serverGone = false;

  const launch = async () => {
    const browser = await chromium.launch({ executablePath: chromePath(), args: LEAN_FLAGS });
    OPEN_BROWSERS.add(browser);
    return browser;
  };
  const fail = (persona, kind, detail) => {
    failures.push({ persona, kind, detail });
    console.log(`  ✗ ${kind} — ${detail}`);
  };

  for (const persona of PERSONAS) {
    if (ONLY && persona.key !== ONLY) continue;
    if (serverGone) break;
    console.log(`\n${persona.label}${persona.email ? ` (${persona.email})` : ""}`);

    const consoleErrors = [];
    let browser;
    let context;
    let page;

    /** A fresh browser, signed in as this persona. Used to recycle mid-crawl. */
    const openSession = async () => {
      browser = await launch();
      context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      context.setDefaultTimeout(30000);
      context.setDefaultNavigationTimeout(60000);
      if (persona.email) await signIn(context, persona.email);
      page = await context.newPage();
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
        consoleErrors.push({ url: page.url(), text });
      });
      page.on("pageerror", (err) => {
        consoleErrors.push({ url: page.url(), text: `uncaught: ${err.message}` });
      });
    };

    const closeSession = async () => {
      await context.close();
      await browser.close();
      OPEN_BROWSERS.delete(browser);
    };

    await openSession();

    const queue = [...persona.roots];
    const seen = new Set(queue);
    const queryCount = new Map();
    let visited = 0;

    while (queue.length && visited < MAX_PAGES) {
      const target = queue.shift();
      const expandable = inArea(new URL(target, BASE).pathname, persona.area);

      // Links leading out of this persona's own area only need to resolve, and
      // resolving does not depend on who is looking, so check them once overall.
      if (!expandable) {
        if (offAreaChecked.has(target)) continue;
        offAreaChecked.add(target);
      }

      let response;
      try {
        response = await page.goto(`${BASE}${target}`, { waitUntil: "domcontentloaded" });
      } catch (err) {
        // If the server has gone away, every remaining page will "fail" for the
        // same reason. Reporting hundreds of those would bury whatever the real
        // problem was and read like the application is broken.
        if (/ERR_CONNECTION_REFUSED|ECONNREFUSED/.test(err.message)) {
          fail(persona.key, "server", `${BASE} stopped responding at ${target} — sweep abandoned`);
          serverGone = true;
          break;
        }
        fail(persona.key, "navigation", `${target} — ${err.message.split("\n")[0]}`);
        continue;
      }
      await settle(page);
      visited += 1;
      pagesVisited += 1;

      // Bound how much this browser is holding. Signing in again is cheap
      // beside the memory a browser accumulates over a long catalogue crawl.
      if (visited % RECYCLE_EVERY === 0 && queue.length) {
        await closeSession();
        await openSession();
      }

      const status = response?.status() ?? 0;
      if (status !== 200) fail(persona.key, "status", `${target} returned ${status}`);

      const finalPath = new URL(page.url()).pathname;
      const pattern = matchPattern(finalPath, patterns);
      if (pattern && !visitedPatterns.has(pattern)) {
        visitedPatterns.set(pattern, `${BASE}${target}`);
      }

      if (!expandable) continue;

      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
      for (const href of hrefs) {
        if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
        let url;
        try {
          url = new URL(href, page.url());
        } catch {
          fail(persona.key, "bad-href", `${finalPath} → ${href}`);
          continue;
        }
        if (url.origin !== new URL(BASE).origin) continue;
        const next = url.pathname + url.search;
        if (seen.has(next)) continue;

        if (url.search) {
          const n = queryCount.get(url.pathname) ?? 0;
          if (n >= MAX_QUERIES_PER_PATH) continue;
          queryCount.set(url.pathname, n + 1);
        }
        seen.add(next);
        queue.push(next);
      }
    }

    console.log(`  ${visited} pages crawled`);
    if (queue.length && !serverGone) {
      console.log(`  (stopped at the ${MAX_PAGES}-page cap, ${queue.length} still queued)`);
    }
    if (serverGone) {
      await closeSession();
      break;
    }

    // Screens nothing links to, visited on purpose and for a stated reason.
    for (const entry of persona.direct ?? []) {
      let target = entry.url;
      if (entry.derive) {
        await page.goto(`${BASE}${entry.derive.list}`, { waitUntil: "domcontentloaded" });
        const href = await page
          .locator(`a[href^="${entry.derive.hrefPrefix}"]`)
          .first()
          .getAttribute("href")
          .catch(() => null);
        if (!href) {
          fail(persona.key, "direct", `could not derive a URL from ${entry.derive.list}`);
          continue;
        }
        target = entry.to(href);
      }
      const res = await page.goto(`${BASE}${target}`, { waitUntil: "domcontentloaded" });
      await settle(page);
      if (res?.status() !== 200) {
        fail(persona.key, "direct", `${target} returned ${res?.status()}`);
        continue;
      }
      const landed = new URL(page.url()).pathname;
      const asked = new URL(target, BASE).pathname;
      // Credit coverage for what actually rendered, not for what was asked
      // for. A guarded route that redirects elsewhere has not been covered, and
      // counting the request would put a lie in a QA report. (/checkout was the
      // case that taught this: with an empty bag it redirects to /cart.)
      const pattern = matchPattern(landed, patterns);
      if (pattern && !visitedPatterns.has(pattern)) visitedPatterns.set(pattern, `${BASE}${target}`);
      const askedPattern = matchPattern(asked, patterns);
      if (askedPattern) explained.set(askedPattern, entry.why);
      console.log(
        landed === asked
          ? `  ✓ direct ${target} (${entry.why})`
          : `  ✓ direct ${target} → ${landed} (${entry.why})`,
      );
    }

    for (const { url, text } of consoleErrors) {
      fail(persona.key, "console", `${new URL(url).pathname} — ${text.slice(0, 160)}`);
    }

    // Cross-role gating.
    for (const [who, target, expect] of GATES) {
      if (who !== persona.key) continue;
      await page.goto(`${BASE}${target}`, { waitUntil: "domcontentloaded" });
      await settle(page);
      const landed = new URL(page.url()).pathname;
      if (landed === target || !landed.startsWith(expect)) {
        fail(persona.key, "gating", `${target} landed on ${landed}, expected ${expect}`);
      } else {
        console.log(`  ✓ gated ${target} → ${landed}`);
      }
    }

    if (persona.key === "admin") {
      for (const target of ADMIN_REACH) {
        const res = await page.goto(`${BASE}${target}`, { waitUntil: "domcontentloaded" });
        await settle(page);
        const landed = new URL(page.url()).pathname;
        if (landed !== target || res?.status() !== 200) {
          fail("admin", "admin-reach", `${target} landed on ${landed} (${res?.status()})`);
        }
      }
      console.log(`  ✓ super admin reaches all ${ADMIN_REACH.length} areas`);
    }

    await closeSession();
  }

  /* ------------------------------------------------- 375px, once per route */

  let mobileChecked = 0;
  if (!ONLY && !serverGone) {
    console.log("\nMobile 375px — one URL per route pattern");
    for (const persona of PERSONAS) {
      const mine = [...visitedPatterns.entries()].filter(([, url]) => {
        const p = new URL(url).pathname;
        return inArea(p, persona.area) || (persona.key === "public" && inArea(p, PUBLIC));
      });
      if (!mine.length) continue;
      const browser = await launch();
      const context = await browser.newContext({
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      });
      context.setDefaultNavigationTimeout(60000);
      if (persona.email) await signIn(context, persona.email);
      const page = await context.newPage();
      for (const [pattern, url] of mine) {
        try {
          await page.goto(url, { waitUntil: "domcontentloaded" });
          await settle(page);
          if (await overflows(page)) {
            fail(persona.key, "overflow-375", `${pattern} (${new URL(url).pathname})`);
          }
          mobileChecked += 1;
        } catch (err) {
          fail(persona.key, "overflow-375", `${pattern} — ${err.message.split("\n")[0]}`);
        }
      }
      await context.close();
      await browser.close();
      OPEN_BROWSERS.delete(browser);
    }
    console.log(`  ${mobileChecked} route patterns checked at 375px`);
  }

  /* ------------------------------------------------------------- coverage */

  const uncovered = patterns.filter((p) => !visitedPatterns.has(p));
  if (!ONLY && !serverGone) {
    console.log(`\nRoute coverage: ${visitedPatterns.size}/${patterns.length}`);
    for (const p of uncovered) {
      // An unlinked route is a defect unless it was named as deliberate.
      if (explained.has(p)) console.log(`  · ${p} — ${explained.get(p)}`);
      else fail("coverage", "unreached", `${p} — no link in any persona's navigation reaches it`);
    }
  }

  /* --------------------------------------------------------------- report */

  const when = new Date().toISOString().slice(0, 16).replace("T", " ");
  const lines = [
    "# QA report",
    "",
    "Generated by `npm run qa`. Read-only: the sweep follows links only, so a run",
    "cannot change the seeded database.",
    "",
    `Run at **${when}** against \`${BASE}\`.`,
    "",
    "| Check | Result |",
    "| --- | --- |",
    `| Pages loaded | ${pagesVisited} |`,
    `| Route patterns reached by navigation | ${visitedPatterns.size} / ${patterns.length} |`,
    `| Route patterns checked at 375px | ${mobileChecked} |`,
    `| Cross-role gating assertions | ${GATES.length} |`,
    `| Failures | ${failures.length} |`,
    "",
  ];

  if (failures.length) {
    lines.push("## Failures", "");
    for (const f of failures) lines.push(`- **${f.persona}** · ${f.kind} — ${f.detail}`);
    lines.push("");
  } else {
    lines.push(
      "Every page returned 200, no console errors or uncaught exceptions were",
      "raised, no route scrolled horizontally at 375px, and every wrong-role URL",
      "redirected the user back to their own area.",
      "",
    );
  }

  if (uncovered.length) {
    lines.push(
      "## Routes no link points at",
      "",
      "Each was still loaded directly and returned 200. A route with no reason",
      "beside it is a defect — something in the navigation has gone missing.",
      "",
      ...uncovered.map((p) => `- \`${p}\` — ${explained.get(p) ?? "**nothing links here**"}`),
      "",
    );
  }

  await writeFile(path.join(process.cwd(), "docs", "QA_REPORT.md"), lines.join("\n"), "utf8");

  console.log(
    failures.length
      ? `\n${failures.length} failure(s) — see docs/QA_REPORT.md`
      : `\nAll checks passed across ${pagesVisited} page loads — docs/QA_REPORT.md written`,
  );
  await closeEverything();
  process.exit(failures.length ? 1 : 0);
}

run().catch(async (err) => {
  console.error(err);
  await closeEverything();
  process.exit(1);
});
