/**
 * Build docs/SRS_COVERAGE.md — every section of the SRS, and where it lives.
 *
 *   npm run srs:coverage
 *
 * The map is derived, not written by hand. Source files cite the sections they
 * implement in their doc comments ("Coupon administration — SRS §126"), and this
 * script reads those citations back out. That means the document cannot drift
 * from the code: delete a screen and its section stops being claimed.
 *
 * Sections with no citation are not silently omitted. Each is listed with a
 * reason from NOTES below, and a section that is neither cited nor explained is
 * reported as a gap in the document itself.
 *
 * docs/srs-sections.json holds the 202 section numbers and titles, extracted
 * from the supplied SRS PDF.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
/**
 * Only the application and the schema. Documentation is deliberately excluded:
 * if docs/ counted, writing a paragraph about §180 would mark §180 implemented,
 * and this table would measure how much was written rather than how much was
 * built.
 */
const SEARCH = ["src", "prisma"];
const SKIP = new Set(["generated", "node_modules", "migrations"]);
const EXT = new Set([".ts", ".tsx", ".prisma", ".css"]);

/**
 * A comment may name a section it deliberately does **not** implement, so the
 * decision sits beside the code rather than only in this document. Those
 * mentions must not count as coverage, so they are marked and stripped:
 *
 *   SRS-NOT-BUILT: §151, §152 — reason
 */
const NOT_BUILT_MARKER = /SRS-NOT-BUILT:[^\n]*/g;

/** Chapter boundaries, used only to group the output. */
const CHAPTERS = [
  [1, 17, "Business context"],
  [18, 33, "User journeys"],
  [34, 51, "Customer module"],
  [52, 68, "Seller module"],
  [69, 90, "Super Admin module"],
  [91, 114, "Operations — warehouse, QC, logistics"],
  [115, 122, "Finance module"],
  [123, 129, "Marketing module"],
  [130, 140, "Customer support module"],
  [141, 165, "Public website"],
  [166, 185, "Technical requirements"],
  [186, 202, "Development guidelines"],
];

/**
 * Why a section carries no citation. Every uncited section needs an entry, and
 * the generated document names any that does not — so a real gap cannot hide
 * behind an empty row.
 *
 *   context  — narrative. Vision, business model, chapter openers. Nothing to build.
 *   journey  — prose restating a flow implemented under a functional section.
 *   docs     — answered in the documentation rather than in code.
 *   scope    — deliberately not built, with the reason.
 *   gap      — should exist and does not.
 */
const NOTES = {
  1: ["context", "Confidentiality terms"],
  2: ["context", "Document metadata"],
  3: ["context", "States the purpose of the SRS itself"],
  4: ["context", "Narrative overview"],
  5: ["context", "Brand purpose — informs the tone of the storefront copy"],
  6: ["context", "Vision statement"],
  7: ["context", "Mission statement"],
  8: ["context", "Platform type — the B2C/B2B split it describes is built as `Customer.customerType`"],
  9: ["context", "Stakeholder list — realised as the nine roles"],
  10: ["context", "Business objectives"],
  11: ["context", "Business model narrative"],
  12: ["context", "Restates the marketplace flow implemented across §52-114"],
  15: ["context", "Ecosystem diagram"],
  18: ["context", "Chapter opener"],
  19: ["context", "Workflow diagram, implemented as the sub-order pipeline"],
  20: ["journey", "The storefront, signed out — `/`, `/shop`, `/product/[slug]`"],
  22: ["journey", "Listing, facets and search — `/shop`, `/search`"],
  23: ["journey", "`/product/[slug]`"],
  24: ["journey", "`/cart`"],
  25: ["journey", "`/checkout`"],
  26: ["journey", "The payment step of `/checkout`. No gateway is connected, and the page says so"],
  27: ["journey", "Seller confirmation, then the operations pipeline"],
  28: ["journey", "`/operations/warehouse`"],
  29: ["journey", "`/operations/qc`"],
  30: ["journey", "The `PACKING` → `READY_FOR_DISPATCH` states, worked from the warehouse desk"],
  31: ["journey", "`/operations/logistics`"],
  32: ["journey", "The `DELIVERED` transition and its customer notification"],
  33: ["journey", "`/account/support` and `/admin/support`"],
  91: ["context", "Chapter opener for §92-114"],
  115: ["context", "Chapter opener for §116-122"],
  141: ["context", "Chapter opener for §142-165"],
  143: ["docs", "The route tree is the site map; see the header, mega-menu and footer"],
  161: ["docs", "`/login`, `/register`, `/forgot-password` — see `src/app/(auth)`"],
  162: ["docs", "Verified rather than annotated: `npm run qa` asserts no route scrolls horizontally at 375px"],
  166: ["context", "Chapter opener for §167-185"],
  167: ["docs", "README — Technology, and the three authorisation layers"],
  168: ["docs", "README — Project structure"],
  169: ["docs", "The `src/lib/<domain>/` split; see README"],
  170: ["docs", "docs/DATA_MODEL.md"],
  171: ["docs", "docs/ERD.md"],
  174: [
    "scope",
    "No REST or GraphQL layer. Writes are Server Actions and reads are server components, so there is no public API surface to design — deliberate, and noted in README",
  ],
  175: [
    "scope",
    "Nothing third-party is connected: no payment gateway, no SMS, email or WhatsApp provider, no courier API. Each is stated on the screen that would have used it",
  ],
  176: ["scope", "Images are committed under `public/catalogue/`. No object store, so the project runs offline"],
  177: [
    "scope",
    "In-app `Notification` rows only. Delivery channels depend on integrations that are not connected",
  ],
  180: ["scope", "No load testing was performed. The indexes the query paths need are in the schema"],
  181: ["docs", "README — Why SQLite locally, and what moving to PostgreSQL costs"],
  182: ["scope", "The database is a single file — `dev.db`. Backup is copying it"],
  183: ["docs", "README — Running the project. The deliverable is run locally, not deployed"],
  184: ["docs", "ESLint and TypeScript strict mode, both clean; `npm run lint`, `npm run typecheck`"],
  185: ["context", "Roadmap"],
  186: ["context", "Chapter opener"],
  187: ["context", "Instructions to the developer, not requirements on the software"],
  188: ["context", "Instructions to the developer"],
  189: ["context", "Instructions to the developer"],
  190: ["docs", "Same as §184"],
  191: ["docs", "Design tokens in `src/app/globals.css`, sampled from the supplied brand assets"],
  192: ["scope", "Same as §180"],
  195: ["docs", "`npm run qa` and `npx tsx prisma/seed-check.ts`; see docs/QA_REPORT.md"],
  196: ["docs", "docs/QA_REPORT.md, regenerated by `npm run qa`"],
  197: ["context", "Process"],
  198: ["docs", "The `docs/` folder and the doc comment on every module"],
  199: ["context", "Process"],
  200: ["context", "Agenda for the live meeting — SRS §200 withholds final scope until then"],
  201: ["context", "Process"],
  202: ["context", "Closing note"],
};

const LABEL = {
  context: "Narrative",
  journey: "Journey",
  docs: "Documented",
  scope: "Out of scope",
  gap: "**Gap**",
};

/** Every source file worth searching. */
async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (EXT.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

/** `src/app/admin/finance/page.tsx` → `/admin/finance`; anything else stays a path. */
function label(file) {
  const rel = path.relative(ROOT, file).replaceAll("\\", "/");
  if (!rel.startsWith("src/app/") || !rel.endsWith("/page.tsx")) return `\`${rel}\``;
  const route = rel
    .slice("src/app".length, -"/page.tsx".length)
    .replaceAll(/\/\([^)]+\)/g, ""); // route groups shape layouts, not URLs
  return `\`${route === "" ? "/" : route}\``;
}

async function run() {
  const sections = JSON.parse(await readFile(path.join(ROOT, "docs", "srs-sections.json"), "utf8"));
  const files = (await Promise.all(SEARCH.map((d) => walk(path.join(ROOT, d))))).flat();

  /** section number -> Set of labels */
  const where = new Map();
  const declaredNotBuilt = new Map(); // section -> file that says so
  for (const file of files) {
    const raw = await readFile(file, "utf8");
    for (const m of raw.matchAll(NOT_BUILT_MARKER)) {
      for (const s of m[0].matchAll(/§(\d+)/g)) declaredNotBuilt.set(Number(s[1]), label(file));
    }
    const text = raw.replace(NOT_BUILT_MARKER, "");
    // §126, §146-150 and §16.3 all appear in the codebase.
    for (const m of text.matchAll(/§(\d+)(?:\.\d+)?(?:\s*[-–]\s*(\d+))?/g)) {
      const from = Number(m[1]);
      const to = m[2] ? Number(m[2]) : from;
      if (from < 1 || to > 202 || to < from) continue;
      for (let n = from; n <= to; n += 1) {
        if (!where.has(n)) where.set(n, new Set());
        where.get(n).add(label(file));
      }
    }
  }

  const cited = [...where.keys()];
  const gaps = [];
  const unexplained = [];
  const rows = [];
  const disagreements = [];

  // The code and this script must tell the same story about what is missing.
  for (const [n, file] of declaredNotBuilt) {
    if (NOTES[n]?.[0] !== "gap") {
      disagreements.push(`§${n} is marked SRS-NOT-BUILT in ${file} but is not listed as a gap here`);
    }
    if (where.has(n)) {
      disagreements.push(`§${n} is marked SRS-NOT-BUILT in ${file} yet something else cites it`);
    }
  }
  for (const [n, [kind]] of Object.entries(NOTES).map(([k, v]) => [Number(k), v])) {
    if (kind === "gap" && !declaredNotBuilt.has(n)) {
      disagreements.push(`§${n} is listed as a gap here but no source file marks it SRS-NOT-BUILT`);
    }
  }

  for (const [start, end, chapter] of CHAPTERS) {
    rows.push("", `### §${start}–${end} · ${chapter}`, "", "| § | Section | Where it lives |", "| --- | --- | --- |");
    for (let n = start; n <= end; n += 1) {
      const title = sections[String(n)] ?? "—";
      const found = where.get(n);
      if (found) {
        // Routes first, then modules; a route is what a reviewer can open.
        const list = [...found].sort((a, b) => {
          const ar = a.startsWith("`/") ? 0 : 1;
          const br = b.startsWith("`/") ? 0 : 1;
          return ar - br || a.localeCompare(b);
        });
        const shown = list.slice(0, 4).join(", ");
        rows.push(`| ${n} | ${title} | ${shown}${list.length > 4 ? ` +${list.length - 4} more` : ""} |`);
      } else if (NOTES[n]) {
        const [kind, why] = NOTES[n];
        if (kind === "gap") gaps.push([n, title, why]);
        rows.push(`| ${n} | ${title} | ${LABEL[kind]} — ${why} |`);
      } else {
        unexplained.push([n, title]);
        rows.push(`| ${n} | ${title} | **Not accounted for** |`);
      }
    }
  }

  const implemented = cited.length;
  const doc = [
    "# SRS coverage",
    "",
    "Every one of the 202 sections of the supplied SRS, and where it is answered.",
    "",
    "**This document is generated** — `npm run srs:coverage`. The \"where it lives\"",
    "column is read out of the codebase itself: each module names the sections it",
    "implements in its doc comment, and this table is those citations collected. It",
    "cannot claim a screen that has been deleted.",
    "",
    "| | Sections |",
    "| --- | --- |",
    `| Implemented, with code that cites the section | **${implemented}** |`,
    `| Narrative, journey or answered in documentation | ${202 - implemented - gaps.length - unexplained.length} |`,
    `| Not built | ${gaps.length} |`,
    unexplained.length ? `| **Not accounted for** | ${unexplained.length} |` : null,
    "",
    "A section marked *Journey* is prose in the SRS restating a flow that is",
    "implemented and cited under its functional section — §24 Shopping Cart Journey",
    "describes what `/cart` does, and `/cart` cites §42 Shopping Cart.",
    "",
  ].filter((l) => l !== null);

  if (gaps.length) {
    doc.push(
      "## Not built",
      "",
      "Named here rather than left to be discovered.",
      "",
      ...gaps.map(([n, title, why]) => `- **§${n} ${title}** — ${why}`),
      "",
    );
  }

  if (unexplained.length) {
    doc.push(
      "## Not accounted for",
      "",
      "Neither implemented nor explained. Each needs a decision.",
      "",
      ...unexplained.map(([n, title]) => `- **§${n} ${title}**`),
      "",
    );
  }

  doc.push("---", "## The full map", ...rows, "");

  await writeFile(path.join(ROOT, "docs", "SRS_COVERAGE.md"), doc.join("\n"), "utf8");
  console.log(
    `docs/SRS_COVERAGE.md — ${implemented}/202 sections cited by code, ` +
      `${gaps.length} not built, ${unexplained.length} unaccounted for`,
  );
  for (const d of disagreements) console.error(`  ✗ ${d}`);
  if (unexplained.length || disagreements.length) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
