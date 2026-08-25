import { NextResponse, type NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { demoGate } from "@/lib/demo-gate";
import {
  ADMIN_ROLES,
  OPERATIONS_ROLES,
  ROLES,
  ROLE_HOME,
  type RoleCode,
} from "@/lib/constants";

/**
 * Route gating.
 *
 * Next.js 16 renamed Middleware to Proxy; the file must be `src/proxy.ts`,
 * alongside `app/`. Behaviour is otherwise the same as Middleware.
 *
 * This is an OPTIMISTIC check only. It reads and verifies the session cookie's
 * signature and nothing else — no database queries, because this runs on every
 * request including prefetches. It keeps signed-out users out of the panels and
 * sends signed-in users to the right place.
 *
 * It is NOT the security boundary. That is src/lib/auth/dal.ts, which re-checks
 * against the database on every protected read, and the per-action checks in
 * every Server Action. A user suspended mid-session still holds a validly signed
 * cookie; only the DAL catches that.
 */

/** Route prefix → roles allowed to enter it. */
const PROTECTED_AREAS: { prefix: string; allow: RoleCode[] }[] = [
  { prefix: "/account", allow: [ROLES.CUSTOMER] },
  { prefix: "/seller", allow: [ROLES.SELLER] },
  { prefix: "/admin", allow: ADMIN_ROLES },
  { prefix: "/operations", allow: OPERATIONS_ROLES },
];

/** Signed-in users have no reason to see these; bounce them to their home. */
const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];

/**
 * Files served straight out of `public/`. The matcher below deliberately lets
 * these reach the Proxy so the hosted demo's password gate covers images too —
 * a gate that leaves every photograph fetchable by URL is not a gate. They need
 * nothing else from this file, so they return immediately, before any session
 * work: no cookie read, no signature verification, no crypto per image.
 */
const PUBLIC_ASSET = /\.(?:png|jpe?g|svg|webp|avif|ico|gif|txt|xml|webmanifest)$/i;

export async function proxy(request: NextRequest) {
  // First, and before everything: on a hosted demo this challenges the request.
  // Inert unless DEMO_PASSWORD is set, so local runs are untouched.
  const challenge = demoGate(request);
  if (challenge) return challenge;

  const response = await route(request);

  // Keep a password-gated demo out of search results. This is read per request
  // rather than declared in next.config.ts, because `headers()` there is
  // evaluated once at BUILD time — a build that did not happen to have
  // DEMO_PASSWORD in its environment would silently ship without this, which is
  // exactly the kind of gap you only notice once the URL has been indexed.
  if (process.env.DEMO_PASSWORD) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

/** The route gating itself, unchanged by the demo gate wrapped around it. */
async function route(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ASSET.test(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decryptSession(token);

  const area = PROTECTED_AREAS.find(
    (candidate) =>
      pathname === candidate.prefix || pathname.startsWith(`${candidate.prefix}/`),
  );

  if (area) {
    if (!session) {
      const loginUrl = new URL("/login", request.nextUrl);
      // Preserve the destination so login can return them to it.
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!area.allow.includes(session.role)) {
      // Authenticated but wrong role — send them to their own dashboard rather
      // than to /login, which would look like a broken session.
      return NextResponse.redirect(
        new URL(ROLE_HOME[session.role] ?? "/", request.nextUrl),
      );
    }
  }

  if (session && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(
      new URL(ROLE_HOME[session.role] ?? "/", request.nextUrl),
    );
  }

  return NextResponse.next();
}

export const config = {
  // Skips API routes (they do their own checks) and Next's own build output,
  // which carries no user content. Everything else — including files under
  // `public/` — reaches the Proxy, so the hosted demo's password gate applies
  // to images as well as pages. Assets exit on the first line of the handler,
  // so the wider net costs a regex test rather than a session decrypt.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
