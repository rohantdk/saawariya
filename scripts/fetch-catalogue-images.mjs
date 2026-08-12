/**
 * Fetches the catalogue imagery from Wikimedia Commons.
 *
 *   node scripts/fetch-catalogue-images.mjs
 *
 * This is a DEVELOPMENT tool, not part of `npm run setup`. The images it
 * downloads are committed to the repository under public/catalogue/, because
 * the client unzips this project and runs it on their own machine — a demo that
 * needs network access to render its own product photos is a demo that breaks
 * during the review it exists for.
 *
 * It is committed anyway so the provenance is reproducible: the manifest names
 * every source file, and re-running regenerates the images, the credits page
 * and the seed's image map from it.
 *
 * Everything in the manifest is public domain or CC0 — see
 * public/catalogue/CREDITS.md, which this script writes.
 *
 * LOOK AT WHAT THIS DOWNLOADS before trusting it. Commons titles are not always
 * accurate: `Head Cloth (Phulkari) LACMA M.64.24.1.jpg` turned out to hold a
 * 16th-century European woodcut, and it was caught only by viewing the images.
 * If you add to the manifest, check the result rather than the filename.
 *
 * Two Commons constraints are baked in below, both learned by hitting them:
 *   - Hand-built thumbnail URLs are rejected (HTTP 400). The permitted widths
 *     vary per file, so the only safe URL is the one the API returns.
 *   - upload.wikimedia.org throttles hard. One request per second still trips
 *     it; three seconds apart runs clean. Hence the deliberate slowness — a
 *     full run takes a few minutes and only ever needs to happen once.
 */
import {
  writeFileSync,
  mkdirSync,
  existsSync,
  readFileSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(ROOT, "scripts", "catalogue-images.json");
const OUT_DIR = join(ROOT, "public", "catalogue");
const SEED_MAP = join(ROOT, "prisma", "seed", "images.ts");

const UA = { "User-Agent": "SaawariyaSeedBot/1.0 (evaluation project)" };
const WIDTH = 1024; // the API snaps this to the nearest permitted width
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const entries = Object.entries(manifest.pools).flatMap(([pool, items]) =>
  items.map((item) => ({ pool, ...item })),
);

console.log(`Fetching ${entries.length} images from Wikimedia Commons\n`);

/** Resolve permitted thumbnail URLs, 40 titles per API call. */
async function resolveThumbs(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40);
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json" +
      `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${WIDTH}&titles=` +
      encodeURIComponent(batch.map((t) => `File:${t}`).join("|"));
    const res = await fetch(url, { headers: UA });
    if (!res.ok) throw new Error(`Commons API returned ${res.status}`);
    const data = await res.json();
    for (const page of Object.values(data?.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      if (info?.thumburl) {
        out.set(page.title.replace(/^File:/, ""), info.thumburl);
      }
    }
    await sleep(500);
  }
  return out;
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// Already-present files are kept unless --force is passed. Commons throttling
// means a full run occasionally drops one or two images; re-running then costs
// only the stragglers instead of another twenty minutes.
const force = process.argv.includes("--force");
const done = [];
const failed = [];
const todo = entries.filter((e) => force || !existsSync(join(OUT_DIR, e.file)));

for (const entry of entries) {
  if (!todo.includes(entry)) {
    done.push(entry); // already on disk — still belongs in the credits and map
  }
}
console.log(
  `${todo.length} to fetch, ${entries.length - todo.length} already present` +
    (force ? " (--force: refetching all)" : ""),
);

const thumbs = await resolveThumbs(todo.map((e) => e.source));

for (const entry of todo) {
  const url = thumbs.get(entry.source);
  if (!url) {
    failed.push({ ...entry, reason: "not found on Commons" });
    console.log(`  MISS  ${entry.file}`);
    continue;
  }

  let ok = false;
  for (let attempt = 0; attempt < 4 && !ok; attempt++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(join(OUT_DIR, entry.file), buf);
      done.push(entry);
      ok = true;
      console.log(`  ok    ${entry.file}  ${(buf.length / 1024).toFixed(0)} KB`);
    } catch (err) {
      if (attempt === 3) {
        failed.push({ ...entry, reason: err.message });
        console.log(`  FAIL  ${entry.file}: ${err.message}`);
      } else {
        await sleep(5000 * (attempt + 1));
      }
    }
  }
  await sleep(3000);
}

// Skipped and freshly-downloaded entries arrive in different orders; restore
// manifest order so the generated map reads banarasi-01, -02, -03 rather than
// whatever sequence this particular run happened to produce.
done.sort((a, b) => entries.indexOf(a) - entries.indexOf(b));

// --- recompress ----------------------------------------------------------
//
// Museum scans arrive at 300 KB - 1.5 MB each, which is far more than a product
// card needs and would put ~25 MB of photographs into the delivered zip. Cap the
// width and re-encode: visually identical at the sizes the UI actually renders,
// roughly a fifth of the bytes.
//
// ffmpeg is used because it is already common on developer machines and this is
// a dev-only script. If it is absent the images are simply left at full size —
// the build still works, it is just heavier.

function optimise(files) {
  const probe = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  if (probe.error) {
    console.log("\nffmpeg not found — skipping recompression (images left full size).");
    return;
  }

  let before = 0;
  let after = 0;
  for (const file of files) {
    const path = join(OUT_DIR, file);
    const tmp = join(OUT_DIR, `.tmp-${file}`);
    before += statSync(path).size;
    const run = spawnSync(
      "ffmpeg",
      ["-y", "-loglevel", "error", "-i", path, "-vf", "scale='min(900,iw)':-2", "-q:v", "4", tmp],
      { stdio: "ignore" },
    );
    if (run.status === 0 && existsSync(tmp)) {
      writeFileSync(path, readFileSync(tmp));
      unlinkSync(tmp);
    }
    after += statSync(path).size;
  }
  const mb = (n) => (n / 1024 / 1024).toFixed(1);
  console.log(`\nRecompressed: ${mb(before)} MB -> ${mb(after)} MB`);
}

optimise(done.map((d) => d.file));

// --- credits -------------------------------------------------------------

const byPool = new Map();
for (const entry of done) {
  if (!byPool.has(entry.pool)) byPool.set(entry.pool, []);
  byPool.get(entry.pool).push(entry);
}

const credits = [
  "# Catalogue image credits",
  "",
  "Every image in this directory comes from [Wikimedia Commons](https://commons.wikimedia.org)",
  "and is in the **public domain** or released under **CC0**. Neither requires",
  "attribution; the sources are listed anyway so the licensing can be verified",
  "rather than taken on trust.",
  "",
  "Most are photographs of museum textile holdings — the Metropolitan Museum of",
  "Art, the Cleveland Museum of Art, LACMA, the Honolulu Museum of Art and",
  "Cooper Hewitt — which is why they are shot flat against neutral grounds.",
  "",
  "Regenerate with `node scripts/fetch-catalogue-images.mjs`.",
  "",
];

for (const [pool, items] of [...byPool].sort()) {
  credits.push(`## ${pool}`, "");
  credits.push("| File | Source | Licence |", "| --- | --- | --- |");
  for (const item of items) {
    const title = item.source.replace(/\|/g, "-");
    credits.push(`| \`${item.file}\` | [${title}](${item.page}) | ${item.license} |`);
  }
  credits.push("");
}
writeFileSync(join(OUT_DIR, "CREDITS.md"), credits.join("\n"));

// --- seed image map ------------------------------------------------------

const poolNames = [...byPool.keys()].sort();
const seedFile = `// GENERATED FILE — do not edit by hand.
// Written by scripts/fetch-catalogue-images.mjs from scripts/catalogue-images.json.
//
// Paths are public/ URLs, so they resolve as-is in <Image src>. Provenance and
// licensing for every file are in public/catalogue/CREDITS.md.

/** Textile types the catalogue has photography for. */
export type ImagePool =
${poolNames.map((p) => `  | "${p}"`).join("\n")};

export const CATALOGUE_IMAGES: Record<ImagePool, string[]> = {
${poolNames
  .map(
    (pool) =>
      `  ${pool}: [\n${byPool
        .get(pool)
        .map((i) => `    "/catalogue/${i.file}",`)
        .join("\n")}\n  ],`,
  )
  .join("\n")}
};
`;
writeFileSync(SEED_MAP, seedFile);

console.log(
  `\n${done.length} downloaded, ${failed.length} failed.` +
    `\nWrote public/catalogue/CREDITS.md and prisma/seed/images.ts`,
);
if (failed.length) process.exitCode = 1;
