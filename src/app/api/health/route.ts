import { NextResponse } from "next/server";

/**
 * Liveness probe for the hosting platform.
 *
 * WHY IT IS NOT JUST `/`. A hosted demo runs behind the password gate in
 * `src/lib/demo-gate.ts`, which answers 401 to anything without credentials —
 * including the platform's health check, which has none. Pointing the check at
 * `/` makes a perfectly healthy container look dead, and the deploy is rolled
 * back after the retry window with nothing wrong in the logs.
 *
 * `/api/*` is excluded from the Proxy matcher, so this route bypasses the gate
 * without punching a hole in it for anything else.
 *
 * It deliberately does NOT touch the database. This answers "is the server
 * accepting requests", which is the question the platform is asking. Folding a
 * query in here would take the whole site down over a slow connection, and
 * would also mean a public endpoint doing database work on every probe.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok", service: "saawariya" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
