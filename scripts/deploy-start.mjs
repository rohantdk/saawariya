#!/usr/bin/env node
/**
 * Saawariya — hosted start-up.
 *
 * The container's own filesystem is thrown away on every deploy, so the SQLite
 * file lives on a mounted volume instead. This script is what stands between a
 * fresh container and a working demo:
 *
 *   1. checks DATABASE_URL points somewhere that survives a redeploy
 *   2. applies migrations (every boot — cheap, and a no-op once applied)
 *   3. seeds demo data, but ONLY the first time this volume is used
 *   4. hands over to `next start`
 *
 * Step 3 is the one with a decision in it. Re-seeding on every deploy would
 * silently discard anything the client did while reviewing — the order they
 * placed, the product they approved — which is exactly the work the demo exists
 * to show. So the seed runs once and leaves a marker on the volume beside the
 * database. To deliberately reset the demo, delete that marker (or the whole
 * volume) and redeploy; `npm run db:seed` against the volume does the same job.
 *
 * Usage:  node scripts/deploy-start.mjs
 */

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const RESET = "[0m";
const BOLD = "[1m";
const DIM = "[2m";
const RED = "[31m";
const GREEN = "[32m";

const log = (message) => console.log(`${DIM}[boot]${RESET} ${message}`);
const ok = (message) => console.log(`${DIM}[boot]${RESET} ${GREEN}✓${RESET} ${message}`);

function fail(message, detail) {
  console.error(`\n${RED}${BOLD}[boot] ${message}${RESET}`);
  if (detail) console.error(`${detail}\n`);
  process.exit(1);
}

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
}

/**
 * Turn `file:/data/saawariya.db` into `/data/saawariya.db`.
 * Returns null for any non-SQLite URL, which is not an error — it just means
 * the volume checks below do not apply.
 */
function sqlitePathFrom(url) {
  if (!url?.startsWith("file:")) return null;
  return url.slice("file:".length);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  fail(
    "DATABASE_URL is not set.",
    "  Set it to a path on the mounted volume, e.g.\n" +
      "    DATABASE_URL=file:/data/saawariya.db\n\n" +
      "  See docs/DEPLOYMENT.md.",
  );
}

if (!process.env.SESSION_SECRET) {
  fail(
    "SESSION_SECRET is not set.",
    "  Sign-in would fail at the first attempt with an error that looks\n" +
      "  nothing like the real cause. Generate one with:\n" +
      "    openssl rand -base64 32",
  );
}

const dbPath = sqlitePathFrom(databaseUrl);

if (dbPath) {
  const dbDir = dirname(dbPath);

  // A relative path here is the classic way to lose a hosted demo's data: it
  // resolves inside the container, which is replaced on the next deploy. Say so
  // now rather than letting the database quietly vanish a week later.
  if (!dbPath.startsWith("/")) {
    fail(
      `DATABASE_URL points at a relative path (${dbPath}).`,
      "  On a hosted deploy that lands inside the container's own filesystem,\n" +
        "  which is discarded on every redeploy. Point it at the mounted volume:\n" +
        "    DATABASE_URL=file:/data/saawariya.db",
    );
  }

  if (!existsSync(dbDir)) {
    // Better to create it than to fail: on some hosts the volume is mounted
    // empty and the directory genuinely does not exist yet.
    mkdirSync(dbDir, { recursive: true });
    log(`created ${dbDir}`);
  }

  log(`database: ${dbPath}`);
}

log("applying migrations");
run("npx", ["prisma", "migrate", "deploy"]);
ok("migrations applied");

// The marker sits on the volume, not in the image, so it survives redeploys
// exactly as the database does. Its presence means "this volume has been
// seeded", which is the only question worth asking here.
const marker = dbPath ? join(dirname(dbPath), ".saawariya-seeded") : null;

if (marker && !existsSync(marker)) {
  log("first boot on this volume — seeding demo data");
  run("npx", ["tsx", "prisma/seed.ts"]);
  writeFileSync(marker, `seeded ${new Date().toISOString()}\n`);
  ok("demo data seeded");
} else if (marker) {
  ok("volume already seeded — leaving existing data alone");
}

const port = process.env.PORT ?? "3000";
log(`starting Next.js on port ${port}`);

// Replace this process's role with the server, forwarding signals so the host
// can stop and restart the container cleanly.
const server = spawn("npx", ["next", "start", "--port", port], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.kill(signal));
}

server.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
