import { NextResponse, type NextRequest } from "next/server";

/**
 * HTTP Basic Auth in front of the whole site, for hosted demo builds only.
 *
 * WHY THIS EXISTS. Putting the demo on a public URL is what makes the site
 * public, and `public/editorial/CREDITS.md` says plainly that some imagery is
 * not cleared for that yet. A password keeps the build reviewable by the client
 * without publishing it to anyone who finds the URL, and without waiting on the
 * licensing question.
 *
 * WHAT IT IS NOT. This is a curtain, not a security boundary — one shared
 * password, sent on every request, protecting demo data. The real authorisation
 * story is unchanged and lives in `src/lib/auth/dal.ts` and the per-action
 * checks. Do not reach for this to protect anything that matters.
 *
 * It is inert unless `DEMO_PASSWORD` is set, so local development and the
 * delivered project behave exactly as they did before.
 */

/**
 * Constant-time string compare.
 *
 * `===` returns as soon as two bytes differ, so the time it takes leaks how
 * much of the password was guessed correctly. Comparing every character and
 * accumulating the difference takes the same time whether the first character
 * is wrong or only the last one is. Length is folded in the same way rather
 * than short-circuited on.
 */
function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * Returns a 401 when the request should be challenged, or `null` to let it
 * through — either because the gate is switched off, or because the credentials
 * were right.
 */
export function demoGate(request: NextRequest): NextResponse | null {
  const password = process.env.DEMO_PASSWORD;
  if (!password) return null;

  const header = request.headers.get("authorization");

  if (header?.startsWith("Basic ")) {
    let decoded = "";
    try {
      // `atob`, not `Buffer`: Proxy runs on the Edge runtime, where the Node
      // globals are not available.
      decoded = atob(header.slice("Basic ".length).trim());
    } catch {
      decoded = "";
    }

    // The username is ignored — one shared password is the whole scheme. Split
    // on the FIRST colon only, so a password containing colons still works.
    const separator = decoded.indexOf(":");
    const supplied = separator === -1 ? "" : decoded.slice(separator + 1);

    if (timingSafeEqual(supplied, password)) return null;
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Saawariya demo", charset="UTF-8"',
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
