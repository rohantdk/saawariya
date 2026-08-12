#!/usr/bin/env node
/**
 * Saawariya — one-command project setup.
 *
 * Prepares a freshly cloned/unzipped copy so it can be started immediately:
 *   1. creates .env from .env.example (if missing)
 *   2. generates the Prisma client
 *   3. generates the Next.js route types
 *   4. applies database migrations
 *   5. seeds demo data for every role
 *
 * Cross-platform: plain Node, no shell-specific syntax, so it behaves the same
 * on Windows PowerShell, macOS and Linux.
 *
 * Usage:  npm run setup
 */

import { execSync } from 'node:child_process'
import { appendFileSync, copyFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const RESET = '[0m'
const BOLD = '[1m'
const DIM = '[2m'
const RED = '[31m'
const GREEN = '[32m'
const GOLD = '[33m'

let step = 0
const TOTAL_STEPS = 5

function heading(message) {
  step += 1
  console.log(`\n${BOLD}[${step}/${TOTAL_STEPS}] ${message}${RESET}`)
}

function ok(message) {
  console.log(`      ${GREEN}✓${RESET} ${message}`)
}

function run(command) {
  execSync(command, { cwd: root, stdio: 'inherit' })
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split('.')[0])
  const minor = Number(process.versions.node.split('.')[1])
  // Next.js 16 requires Node 20.9.0 or newer.
  if (major < 20 || (major === 20 && minor < 9)) {
    console.error(
      `\n${RED}${BOLD}Unsupported Node.js version.${RESET}\n\n` +
        `  Found:    v${process.versions.node}\n` +
        `  Required: v20.9.0 or newer (Next.js 16 minimum)\n\n` +
        `  Install the current LTS from https://nodejs.org and run this again.\n`
    )
    process.exit(1)
  }
}

/** Parse `KEY=value` lines, ignoring comments and blanks. */
function parseEnvKeys(contents) {
  return new Set(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('=')[0].trim())
      .filter(Boolean)
  )
}

/**
 * Create .env from .env.example, or top up an existing .env with any keys it is
 * missing.
 *
 * The "top up" path matters: `prisma init` writes a .env containing only
 * DATABASE_URL. A copy-only-if-absent setup would leave that file in place and
 * the app would boot without SESSION_SECRET, failing at the first sign-in with
 * an error that looks nothing like the real cause. Existing values are never
 * overwritten — only missing keys are appended.
 */
function syncEnvFile() {
  const envPath = join(root, '.env')
  const examplePath = join(root, '.env.example')

  if (!existsSync(envPath)) {
    copyFileSync(examplePath, envPath)
    ok('.env created from .env.example')
    return
  }

  const example = readFileSync(examplePath, 'utf8')
  const current = readFileSync(envPath, 'utf8')

  const currentKeys = parseEnvKeys(current)
  const missing = example
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return false
      return !currentKeys.has(trimmed.split('=')[0].trim())
    })

  if (missing.length === 0) {
    ok('.env is present and complete')
    return
  }

  appendFileSync(
    envPath,
    `\n# Added by npm run setup — missing from the existing .env\n${missing.join('\n')}\n`
  )
  ok(`.env updated — added ${missing.length} missing key(s)`)
}

function main() {
  console.log(`\n${BOLD}${GOLD}  Saawariya${RESET}${DIM} — multi-vendor textile marketplace${RESET}`)
  console.log(`${DIM}  Setting up your local environment...${RESET}`)

  checkNodeVersion()

  heading('Checking environment file')
  syncEnvFile()

  heading('Generating Prisma client')
  run('npx prisma generate')

  // Next 16 generates the global `PageProps` / `LayoutProps` route types into
  // .next/types, which is not shipped (it is a build artefact). Without this
  // step a freshly unzipped copy fails `npm run typecheck` with one "Cannot
  // find name 'PageProps'" per route — 73 errors that look like a broken
  // deliverable but disappear the moment anything generates them. Same class
  // of first-run trap as the .env top-up above.
  heading('Generating route types')
  run('npx next typegen')

  heading('Applying database migrations')
  run('npx prisma migrate deploy')

  heading('Seeding demo data')
  run('npx tsx prisma/seed.ts')

  console.log(`\n${GREEN}${BOLD}  Setup complete.${RESET}\n`)
  console.log(`  Start the app:      ${BOLD}npm run dev${RESET}`)
  console.log(`  Then open:          ${BOLD}http://localhost:3000${RESET}`)
  console.log(`  Demo logins:        see the credentials table in ${BOLD}README.md${RESET}`)
  console.log(`  Guided tour:        ${BOLD}docs/DEMO_WALKTHROUGH.md${RESET}\n`)
}

try {
  main()
} catch (error) {
  console.error(`\n${RED}${BOLD}  Setup failed.${RESET}`)
  console.error(`  ${error.message}\n`)
  console.error(`  ${DIM}If this persists, delete dev.db and node_modules, then run:${RESET}`)
  console.error(`  ${DIM}npm install && npm run setup${RESET}\n`)
  process.exit(1)
}
