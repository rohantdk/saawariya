/**
 * Mobile audit — 375px, real device emulation, every persona.
 *
 *   npm run build && npm start      # in one terminal
 *   node scripts/mobile-audit.mjs   # in another
 *
 * The QA sweep already asserts that no route scrolls sideways at 375px. That
 * catches the worst failure and misses the rest, because a page can fit the
 * viewport and still be unusable: 10px type, buttons too small to hit, a table
 * squeezed to nothing, an image squashed out of its aspect ratio.
 *
 * This checks the things a person would notice:
 *
 *   1. horizontal overflow, and WHICH element causes it
 *   2. tap targets under 44x44 (the WCAG 2.5.5 / iOS HIG floor)
 *   3. body text under 12px
 *   4. content wider than its container
 *   5. images loading, and at their natural aspect ratio
 *
 * Writes screenshots to docs/mobile-audit/ and a report to
 * docs/MOBILE_AUDIT.md. Read-only: it navigates and signs in, never submits a
 * form that writes.
 */
import { chromium, devices } from "playwright-core";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Saawariya@123";
const OUT = "docs/mobile-audit";

const CHROME_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];

/** Minimum comfortable tap target. WCAG 2.5.5 AAA and the iOS HIG both say 44. */
const MIN_TAP = 44;
/** Below this, body copy stops being comfortable on a phone. */
const MIN_FONT = 12;

const PERSONAS = [
  {
    key: "public", label: "Public storefront", email: null,
    pages: [
      ["home", "/"],
      ["shop", "/shop"],
      ["category", "/shop/sarees"],
      ["search", "/search?q=saree"],
      ["login", "/login"],
      ["register", "/register"],
      ["about", "/page/about-us"],
      ["faq", "/page/faq"],
    ],
  },
  {
    key: "customer", label: "Customer", email: "customer@saawariya.test",
    pages: [
      ["cart", "/cart"],
      ["checkout", "/checkout"],
      ["account", "/account"],
      ["orders", "/account/orders"],
      ["wishlist", "/account/wishlist"],
      ["addresses", "/account/addresses"],
      ["reviews", "/account/reviews"],
      ["support", "/account/support"],
    ],
  },
  {
    key: "seller", label: "Seller", email: "seller@saawariya.test",
    pages: [
      ["dashboard", "/seller"],
      ["orders", "/seller/orders"],
      ["products", "/seller/products"],
      ["inventory", "/seller/inventory"],
      ["settlements", "/seller/settlements"],
      ["reports", "/seller/reports"],
    ],
  },
  {
    key: "admin", label: "Super admin", email: "admin@saawariya.test",
    pages: [
      ["dashboard", "/admin"],
      ["sellers", "/admin/sellers"],
      ["products", "/admin/products"],
      ["orders", "/admin/orders"],
      ["finance", "/admin/finance"],
      ["marketing", "/admin/marketing"],
      ["support", "/admin/support"],
    ],
  },
  {
    key: "ops", label: "Operations", email: "warehouse@saawariya.test",
    pages: [["warehouse", "/operations/warehouse"], ["queue", "/operations/warehouse/queue"]],
  },
];

function chromePath() {
  const found = CHROME_PATHS.find((p) => existsSync(p));
  if (!found) throw new Error(`No Chrome or Edge found. Looked in:\n  ${CHROME_PATHS.join("\n  ")}`);
  return found;
}

/**
 * Runs inside the page. Everything measured here is measured against what the
 * browser actually laid out, not against the source — the whole point is to
 * catch what the CSS did rather than what it meant.
 */
const AUDIT = ({ minTap, minFont }) => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const out = { vw, scrollW: de.scrollWidth, overflow: [], smallTaps: [], smallText: [], images: [] };

  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
    const txt = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 30);
    return `${el.tagName.toLowerCase()}${id}${cls}${txt ? ` "${txt}"` : ""}`;
  };

  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();

    // Overflow: sticks out past the right edge, and no scrollable ancestor is
    // deliberately holding it (a table inside overflow-x:auto is fine).
    if (r.right > vw + 1) {
      let scrollable = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll") { scrollable = true; break; }
      }
      if (!scrollable) out.overflow.push({ el: describe(el), right: Math.round(r.right) });
    }

    // Tap targets. Only leaf-ish interactive elements — a nav wrapping links is
    // not itself a tap target.
    const tag = el.tagName.toLowerCase();
    const interactive =
      tag === "button" || tag === "select" || tag === "textarea" ||
      (tag === "a" && el.hasAttribute("href")) ||
      (tag === "input" && !["hidden", "submit"].includes(el.type)) ||
      el.getAttribute("role") === "button";
    // A skip link is deliberately collapsed until it takes focus, so its
    // resting 1x1 box is not a tap target anyone is expected to hit. Measuring
    // it as one buries the real findings under a row on every single page.
    const srOnly =
      el.className && typeof el.className === "string" && el.className.includes("sr-only");
    if (interactive && !srOnly && (r.width < minTap || r.height < minTap)) {
      out.smallTaps.push({ el: describe(el), w: Math.round(r.width), h: Math.round(r.height) });
    }

    // Text too small to read. Only elements holding their own text.
    const ownText = [...el.childNodes]
      .filter((n) => n.nodeType === 3 && n.textContent.trim())
      .map((n) => n.textContent.trim()).join(" ");
    if (ownText.length > 8) {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs && fs < minFont) out.smallText.push({ el: describe(el), px: Math.round(fs * 10) / 10 });
    }
  }

  for (const img of document.querySelectorAll("img")) {
    if (!visible(img)) continue;
    const r = img.getBoundingClientRect();
    const broken = !img.complete || img.naturalWidth === 0;
    let squashed = false;
    if (!broken && img.naturalWidth && r.width > 4 && r.height > 4) {
      const natural = img.naturalWidth / img.naturalHeight;
      const shown = r.width / r.height;
      const fit = getComputedStyle(img).objectFit;
      // object-fit: cover/contain is a deliberate crop, not a distortion.
      if (fit === "fill" || fit === "none") {
        squashed = Math.abs(natural - shown) / natural > 0.15;
      }
    }
    if (broken || squashed) {
      out.images.push({ src: (img.currentSrc || img.src || "").split("/").slice(-1)[0], broken, squashed });
    }
  }

  const dedupe = (arr, key) => {
    const seen = new Set();
    return arr.filter((x) => !seen.has(x[key]) && seen.add(x[key]));
  };
  out.overflow = dedupe(out.overflow, "el").slice(0, 6);
  out.smallTaps = dedupe(out.smallTaps, "el").slice(0, 6);
  out.smallText = dedupe(out.smallText, "el").slice(0, 6);
  return out;
};

async function signIn(context, email) {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.close();
}

/**
 * Wait for the page to be worth measuring.
 *
 * Two things bite here. Lazy images below the fold never fire `load` until they
 * are scrolled to, so waiting on all of them waits forever — hence the scroll
 * pass, and hence the ceiling on the wait even after it. And a full-page
 * screenshot of a page whose lower images were never triggered shows blank
 * frames, which would read as "broken images" when nothing is wrong.
 */
async function settle(page) {
  await page.waitForLoadState("load").catch(() => {});

  // Walk to the bottom to trigger lazy loading, then back to the top so the
  // screenshot starts where a visitor would.
  await page.evaluate(async () => {
    const step = window.innerHeight;
    const end = document.body.scrollHeight;
    for (let y = 0; y < end; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    window.scrollTo(0, 0);
  }).catch(() => {});

  await page.evaluate(async () => {
    const pending = [...document.images].filter((i) => !i.complete);
    await Promise.race([
      Promise.all(pending.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  }).catch(() => {});

  await page.waitForTimeout(400);
}

async function main() {
  await rm(OUT, { recursive: true, force: true }).catch(() => {});
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({
    executablePath: chromePath(),
    args: ["--force-color-profile=srgb", "--font-render-hinting=none"],
  });

  const findings = [];
  let pages = 0;

  for (const persona of PERSONAS) {
    console.log(`\n${persona.label}`);
    const context = await browser.newContext({
      ...devices["iPhone 12"],
      viewport: { width: 375, height: 812 },
    });
    context.setDefaultTimeout(30000);
    context.setDefaultNavigationTimeout(60000);

    if (persona.email) await signIn(context, persona.email);
    const page = await context.newPage();

    for (const [name, url] of persona.pages) {
      const file = `${persona.key}-${name}.png`;
      try {
        const res = await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
        // A ceiling per page: settling is best-effort, and a page that will not
        // settle should be measured as it stands rather than stop the run.
        await Promise.race([
          settle(page),
          new Promise((r) => setTimeout(r, 20000)),
        ]);
        const status = res ? res.status() : 0;
        const result = await page.evaluate(AUDIT, { minTap: MIN_TAP, minFont: MIN_FONT });
        await page.screenshot({ path: path.join(OUT, file), fullPage: true });
        pages++;

        const issues =
          result.overflow.length + result.smallTaps.length +
          result.smallText.length + result.images.length;
        const flag = result.scrollW > result.vw + 1 ? " ⚠ SCROLLS SIDEWAYS" : "";
        console.log(`  ${issues === 0 && !flag ? "✓" : "•"} ${url}  (${status})${flag}${issues ? `  ${issues} note(s)` : ""}`);
        findings.push({ persona: persona.label, url, status, file, ...result });
      } catch (error) {
        console.log(`  ✗ ${url} — ${error.message.split("\n")[0]}`);
        findings.push({ persona: persona.label, url, status: 0, file: null, error: error.message.split("\n")[0] });
      }
    }
    await context.close();
  }

  await browser.close();

  // ---- report -----------------------------------------------------------
  const scrolls = findings.filter((f) => f.scrollW > f.vw + 1);
  const withOverflow = findings.filter((f) => f.overflow?.length);
  const withTaps = findings.filter((f) => f.smallTaps?.length);
  const withText = findings.filter((f) => f.smallText?.length);
  const withImages = findings.filter((f) => f.images?.length);
  const errored = findings.filter((f) => f.error);

  let md = `# Mobile audit — 375px\n\n`;
  md += `Generated by \`node scripts/mobile-audit.mjs\` against ${BASE}, `;
  md += `iPhone 12 emulation at 375x812.\n\n`;
  md += `| Check | Result |\n| --- | --- |\n`;
  md += `| Pages audited | ${pages} |\n`;
  md += `| Pages scrolling sideways | ${scrolls.length} |\n`;
  md += `| Pages with an element past the right edge | ${withOverflow.length} |\n`;
  md += `| Pages with a tap target under ${MIN_TAP}px | ${withTaps.length} |\n`;
  md += `| Pages with text under ${MIN_FONT}px | ${withText.length} |\n`;
  md += `| Pages with a broken or distorted image | ${withImages.length} |\n`;
  md += `| Pages that failed to load | ${errored.length} |\n\n`;

  const section = (title, rows, render) => {
    if (!rows.length) return "";
    let s = `## ${title}\n\n`;
    for (const f of rows) s += `**${f.persona} · \`${f.url}\`**\n\n${render(f)}\n`;
    return s;
  };

  md += section("Pages that scroll sideways", scrolls, (f) =>
    `Document is ${f.scrollW}px wide in a ${f.vw}px viewport.\n`);
  md += section("Elements past the right edge", withOverflow, (f) =>
    f.overflow.map((o) => `- \`${o.el}\` reaches ${o.right}px\n`).join(""));
  md += section(`Tap targets under ${MIN_TAP}px`, withTaps, (f) =>
    f.smallTaps.map((t) => `- \`${t.el}\` is ${t.w}x${t.h}\n`).join(""));
  md += section(`Text under ${MIN_FONT}px`, withText, (f) =>
    f.smallText.map((t) => `- \`${t.el}\` at ${t.px}px\n`).join(""));
  md += section("Broken or distorted images", withImages, (f) =>
    f.images.map((i) => `- \`${i.src}\` ${i.broken ? "did not load" : "is distorted"}\n`).join(""));
  md += section("Pages that failed to load", errored, (f) => `${f.error}\n`);

  if (!scrolls.length && !withOverflow.length && !withTaps.length && !withText.length && !withImages.length && !errored.length) {
    md += `## No issues found\n\nEvery page fits 375px, every tap target clears ${MIN_TAP}px, no text falls below ${MIN_FONT}px, and every image loaded at its natural proportions.\n`;
  }

  md += `\n---\n\nScreenshots for all ${pages} pages are in \`${OUT}/\`.\n`;
  await writeFile("docs/MOBILE_AUDIT.md", md, "utf8");

  const total = scrolls.length + withOverflow.length + withTaps.length + withText.length + withImages.length + errored.length;
  console.log(`\n${pages} pages audited — ${total === 0 ? "no issues" : `${total} page(s) with notes`}`);
  console.log(`docs/MOBILE_AUDIT.md written, screenshots in ${OUT}/`);
}

main().catch((error) => { console.error(error); process.exit(1); });
