/**
 * Capture full-page screenshots of every major screen, for the demo hand-over.
 *
 *   npm run dev            # in one terminal
 *   node scripts/screenshots.mjs
 *
 * Uses the Chrome/Edge already installed on the machine (playwright-core ships
 * no browser binaries), signs in as each demo role, and writes numbered PNGs to
 * docs/screenshots/. Detail-page URLs are discovered by reading the first row of
 * the matching list page, so they stay correct for whatever the seed produced.
 */
import { chromium } from "playwright-core";
import { mkdir, rm, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "docs", "screenshots");
const PASSWORD = "Saawariya@123";
/** 2 gives retina-sharp PNGs; drop to 1 if a very long page fails to capture. */
const SCALE = Number(process.env.SHOT_SCALE ?? 2);
/** Limit a run to one persona while iterating: ONLY=public node scripts/… */
const ONLY = process.env.ONLY;

const CHROME_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];

/** A shot is either a fixed path, or a list page plus a link pattern to follow. */
const s = (name, url) => ({ name, url });
const first = (name, list, hrefPrefix) => ({ name, list, hrefPrefix });

const PERSONAS = [
  {
    key: "public",
    label: "Public website",
    prefix: "01-public",
    shots: [
      s("home", "/"),
      s("shop-all", "/shop"),
      s("shop-category", "/shop/sarees"),
      s("shop-subcategory", "/shop/sarees/banarasi-sarees"),
      s("product", "/product/pure-zari-banarasi-silk-saree"),
      s("search", "/search?q=silk"),
      s("wholesale", "/wholesale"),
      s("cms-about", "/page/about-us"),
      s("cms-faq", "/page/faq"),
      s("login", "/login"),
      s("register", "/register"),
      s("not-found", "/shop/does-not-exist"),
    ],
  },
  {
    key: "customer",
    label: "Customer panel",
    prefix: "02-customer",
    email: "customer@saawariya.test",
    shots: [
      s("cart", "/cart"),
      s("checkout", "/checkout"),
      s("account-dashboard", "/account"),
      s("orders", "/account/orders"),
      first("order-detail", "/account/orders", "/account/orders/SAAW"),
      s("wishlist", "/account/wishlist"),
      s("addresses", "/account/addresses"),
      s("reviews", "/account/reviews"),
      s("notifications", "/account/notifications"),
      s("support", "/account/support"),
      first("support-thread", "/account/support", "/account/support/TKT"),
      s("settings", "/account/settings"),
    ],
  },
  {
    key: "wholesale",
    label: "Wholesale customer",
    prefix: "03-wholesale",
    email: "wholesale@saawariya.test",
    shots: [
      s("product-wholesale-pricing", "/product/pure-zari-banarasi-silk-saree"),
      s("account", "/account"),
    ],
  },
  {
    key: "seller",
    label: "Seller panel",
    prefix: "04-seller",
    email: "seller@saawariya.test",
    shots: [
      s("dashboard", "/seller"),
      s("orders", "/seller/orders"),
      first("order-detail", "/seller/orders", "/seller/orders/SAAW"),
      s("products", "/seller/products"),
      first("product-edit", "/seller/products", "/seller/products/cm"),
      s("product-new", "/seller/products/new"),
      s("inventory", "/seller/inventory"),
      s("settlements", "/seller/settlements"),
      s("reports", "/seller/reports"),
      s("notifications", "/seller/notifications"),
      s("profile", "/seller/profile"),
    ],
  },
  {
    key: "admin",
    label: "Admin console",
    prefix: "05-admin",
    email: "admin@saawariya.test",
    shots: [
      s("dashboard", "/admin"),
      s("sellers", "/admin/sellers"),
      first("seller-detail", "/admin/sellers", "/admin/sellers/cm"),
      s("products", "/admin/products"),
      first("product-detail", "/admin/products", "/admin/products/cm"),
      s("categories", "/admin/categories"),
      s("customers", "/admin/customers"),
      first("customer-detail", "/admin/customers", "/admin/customers/cm"),
      s("orders", "/admin/orders"),
      first("order-detail", "/admin/orders", "/admin/orders/SAAW"),
      s("inventory", "/admin/inventory"),
      s("reviews", "/admin/reviews"),
      s("settings", "/admin/settings"),
      s("roles", "/admin/roles"),
      s("audit", "/admin/audit"),
    ],
  },
  {
    key: "warehouse",
    label: "Warehouse desk",
    prefix: "06-warehouse",
    email: "warehouse@saawariya.test",
    shots: [
      s("dashboard", "/operations/warehouse"),
      s("queue", "/operations/warehouse/queue"),
      first("parcel", "/operations/warehouse/queue", "/operations/warehouse/queue/SAAW"),
      s("inventory", "/operations/warehouse/inventory"),
      s("stock-ledger", "/operations/warehouse/movements"),
    ],
  },
  {
    key: "qc",
    label: "Quality control desk",
    prefix: "07-qc",
    email: "qc@saawariya.test",
    shots: [
      s("dashboard", "/operations/qc"),
      s("queue", "/operations/qc/queue"),
      first("inspection", "/operations/qc/queue", "/operations/qc/queue/SAAW"),
      s("reports", "/operations/qc/reports"),
    ],
  },
  {
    key: "logistics",
    label: "Logistics desk",
    prefix: "08-logistics",
    email: "logistics@saawariya.test",
    shots: [
      s("dashboard", "/operations/logistics"),
      s("queue", "/operations/logistics/queue"),
      first("parcel", "/operations/logistics/queue", "/operations/logistics/queue/SAAW"),
      s("reports", "/operations/logistics/reports"),
    ],
  },
  {
    key: "finance",
    label: "Finance desk",
    prefix: "09-finance",
    email: "finance@saawariya.test",
    shots: [
      s("dashboard", "/admin/finance"),
      s("settlements", "/admin/finance/settlements"),
      s("refunds", "/admin/finance/refunds"),
      s("payments", "/admin/finance/payments"),
      s("reports", "/admin/finance/reports"),
    ],
  },
  {
    key: "marketing",
    label: "Marketing desk",
    prefix: "10-marketing",
    email: "marketing@saawariya.test",
    shots: [
      s("dashboard", "/admin/marketing"),
      s("coupons", "/admin/marketing/coupons"),
      first("coupon-detail", "/admin/marketing/coupons", "/admin/marketing/coupons/cm"),
      s("banners", "/admin/marketing/banners"),
      first("banner-detail", "/admin/marketing/banners", "/admin/marketing/banners/cm"),
      s("campaigns", "/admin/marketing/campaigns"),
      first("campaign-detail", "/admin/marketing/campaigns", "/admin/marketing/campaigns/cm"),
      s("content", "/admin/marketing/content"),
      first("content-edit", "/admin/marketing/content", "/admin/marketing/content/"),
      s("audience", "/admin/marketing/audience"),
    ],
  },
  {
    key: "support",
    label: "Support desk",
    prefix: "11-support",
    email: "support@saawariya.test",
    shots: [
      s("dashboard", "/admin/support"),
      s("tickets", "/admin/support/tickets"),
      first("ticket-detail", "/admin/support/tickets", "/admin/support/tickets/TKT"),
      s("returns", "/admin/support/returns"),
      first("return-detail", "/admin/support/returns", "/admin/support/returns/SAAW"),
    ],
  },
];

/** Storefront screens worth showing on a phone as well. */
const MOBILE = [
  s("home", "/"),
  s("shop", "/shop"),
  s("product", "/product/pure-zari-banarasi-silk-saree"),
];

const GROUP_LABELS = {
  "01-public": ["Public website", "Storefront as an anonymous visitor sees it."],
  "02-customer": ["Customer panel", "Signed in as customer@saawariya.test — retail buyer."],
  "03-wholesale": ["Wholesale customer", "Same catalogue, B2B pricing and MOQ."],
  "04-seller": ["Seller panel", "Signed in as seller@saawariya.test — Anil Textiles."],
  "05-admin": ["Admin console", "Signed in as admin@saawariya.test — super admin."],
  "06-warehouse": ["Warehouse desk", "Picking, packing and platform-wide stock."],
  "07-qc": ["Quality control desk", "Inspections, verdicts and pass-rate reports."],
  "08-logistics": ["Logistics desk", "Dispatch, tracking and delivery performance."],
  "09-finance": ["Finance desk", "Settlements, refunds and the read-only transaction log."],
  "10-marketing": ["Marketing desk", "Coupons, banners, campaigns and the CMS."],
  "11-support": ["Support desk", "Ticket queue and the returns workflow."],
  "12-mobile": ["Mobile — 375px", "The storefront on a phone-width viewport."],
};

/** A browsable contact sheet, so the folder can be opened rather than dug through. */
async function writeGallery() {
  const files = (await readdir(OUT)).filter((f) => f.endsWith(".png")).sort();
  const groups = new Map();
  for (const file of files) {
    const key = file.slice(0, file.indexOf("-", 3));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(file);
  }

  const title = (file) =>
    file
      .replace(/\.png$/, "")
      .split("-")
      .slice(3)
      .join(" ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const sections = [...groups.entries()]
    .map(([key, list]) => {
      const [label, blurb] = GROUP_LABELS[key] ?? [key, ""];
      const cards = list
        .map(
          (file) => `      <figure>
        <a href="${file}" target="_blank"><img src="${file}" alt="${title(file)}" loading="lazy"></a>
        <figcaption>${title(file)}</figcaption>
      </figure>`,
        )
        .join("\n");
      return `  <section>
    <h2>${label}</h2>
    <p class="blurb">${blurb}</p>
    <div class="grid">
${cards}
    </div>
  </section>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Saawariya — screen gallery</title>
<style>
  :root { --maroon:#7C201F; --cream:#FAF7F0; --ink:#2A2422; --rule:#E4DDD1; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--cream); color:var(--ink);
         font:16px/1.6 ui-sans-serif, system-ui, "Segoe UI", sans-serif; }
  header { background:var(--maroon); color:#fff; padding:2.5rem 2rem; }
  header h1 { margin:0 0 .35rem; font-size:1.9rem; font-weight:600; letter-spacing:.01em; }
  header p { margin:0; opacity:.85; font-size:.95rem; }
  section { padding:2.5rem 2rem; border-bottom:1px solid var(--rule); }
  h2 { margin:0 0 .25rem; font-size:1.3rem; color:var(--maroon); }
  .blurb { margin:0 0 1.5rem; font-size:.9rem; opacity:.7; }
  .grid { display:grid; gap:1.5rem;
          grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); }
  figure { margin:0; background:#fff; border:1px solid var(--rule); border-radius:6px;
           overflow:hidden; }
  figure img { display:block; width:100%; height:300px; object-fit:cover;
               object-position:top center; }
  figcaption { padding:.7rem .9rem; font-size:.85rem; border-top:1px solid var(--rule); }
  footer { padding:2rem; font-size:.85rem; opacity:.6; }
</style>
</head>
<body>
<header>
  <h1>Saawariya — screen gallery</h1>
  <p>${files.length} screens · captured ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · click any image for the full-length capture</p>
</header>
${sections}
<footer>Prepared for Team ARJITAY. Every screen is rendered from the seeded database — no mockups.</footer>
</body>
</html>
`;
  await writeFile(path.join(OUT, "index.html"), html, "utf8");
  console.log("  ✓ index.html");
}

function chromePath() {
  const found = CHROME_PATHS.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      `No Chrome or Edge found. Looked in:\n  ${CHROME_PATHS.join("\n  ")}`,
    );
  }
  return found;
}

/**
 * `networkidle` never fires against `next dev` — the HMR socket keeps a
 * connection open for the life of the page — so wait on `load` and give lazy
 * images a moment to decode instead.
 */
/**
 * `next dev` paints a floating dev-tools badge over every page. It is not part
 * of the product and must not appear in a hand-over screenshot.
 */
async function hideDevOverlay(context) {
  await context.addInitScript(() => {
    const css = "nextjs-portal,[data-nextjs-toast]{display:none !important}";
    const inject = () => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head?.appendChild(style);
    };
    if (document.head) inject();
    else document.addEventListener("DOMContentLoaded", inject);
  });
}

async function settle(page) {
  await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {});
  await page
    .evaluate(
      () =>
        new Promise((resolve) => {
          window.scrollTo(0, document.body.scrollHeight);
          setTimeout(() => {
            window.scrollTo(0, 0);
            resolve();
          }, 400);
        }),
    )
    .catch(() => {});
  await page.waitForTimeout(600);
}

async function shoot(page, file) {
  await settle(page);
  await page.screenshot({
    path: path.join(OUT, file),
    fullPage: true,
    timeout: 30000,
  });
  console.log("  ✓", file);
}

async function signIn(context, email) {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.close();
}

// This script used to add a product to the bag here, because /cart and
// /checkout were empty on a fresh seed. The seed now opens a basket for both
// demo customers, so the shots are plain navigations and the whole run is
// read-only — it can no longer leave rows behind in the database it documents.

async function resolveFirstHref(page, listUrl, hrefPrefix) {
  await page.goto(`${BASE}${listUrl}`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const href = await page
    .locator(`a[href^="${hrefPrefix}"]`)
    .first()
    .getAttribute("href")
    .catch(() => null);
  return href;
}

/**
 * Playwright launches a real browser, so a run that dies takes its Chrome with
 * it only if we say so — otherwise the process is orphaned, holding a couple of
 * gigabytes, and enough orphans will starve the machine of committed memory and
 * kill the dev server. Track it and tear it down on every exit path.
 */
let LAUNCHED = null;

async function closeBrowser() {
  if (!LAUNCHED) return;
  await LAUNCHED.close().catch(() => {});
  LAUNCHED = null;
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, async () => {
    await closeBrowser();
    process.exit(130);
  });
}

async function run() {
  // Rebuild just the contact sheet from whatever is already on disk.
  if (process.argv.includes("--gallery-only")) {
    await writeGallery();
    return;
  }

  if (!ONLY) await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({
    executablePath: chromePath(),
    args: ["--force-color-profile=srgb", "--font-render-hinting=none"],
  });
  LAUNCHED = browser;

  let count = 0;
  for (const persona of PERSONAS) {
    if (ONLY && persona.key !== ONLY) continue;
    console.log(`\n${persona.label}`);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: SCALE,
    });
    context.setDefaultTimeout(30000);
    context.setDefaultNavigationTimeout(60000);
    await hideDevOverlay(context);
    if (persona.email) await signIn(context, persona.email);

    const page = await context.newPage();
    let n = 0;
    for (const shot of persona.shots) {
      n += 1;
      const file = `${persona.prefix}-${String(n).padStart(2, "0")}-${shot.name}.png`;
      try {
        if (shot.list) {
          const href = await resolveFirstHref(page, shot.list, shot.hrefPrefix);
          if (!href) {
            console.log("  – skipped", shot.name, "(no row matched)");
            continue;
          }
          await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
        } else {
          await page.goto(`${BASE}${shot.url}`, { waitUntil: "domcontentloaded" });
        }
        await shoot(page, file);
        count += 1;
      } catch (err) {
        console.log("  ✗", shot.name, "—", err.message.split("\n")[0]);
      }
    }
    await context.close();
  }

  // Phone-width storefront, to show the responsive layout.
  if (ONLY && ONLY !== "mobile") {
    await browser.close();
    console.log(`\n${count} screenshots written to docs/screenshots/`);
    return;
  }
  console.log("\nMobile (375px)");
  const mobile = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await hideDevOverlay(mobile);
  const mpage = await mobile.newPage();
  let m = 0;
  for (const shot of MOBILE) {
    m += 1;
    try {
      await mpage.goto(`${BASE}${shot.url}`, { waitUntil: "domcontentloaded" });
      await shoot(mpage, `12-mobile-${String(m).padStart(2, "0")}-${shot.name}.png`);
      count += 1;
    } catch (err) {
      console.log("  ✗", shot.name, "—", err.message.split("\n")[0]);
    }
  }
  await mobile.close();
  await browser.close();

  await writeGallery();
  console.log(`\n${count} screenshots written to docs/screenshots/`);
}

run().catch(async (err) => {
  console.error(err);
  await closeBrowser();
  process.exit(1);
});
