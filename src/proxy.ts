import { NextResponse, type NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  // Skip API routes, static assets and image files — they either do their own
  // checks or need no session at all.
  matcher: [
    "/((?!api|_next/static|_next/image|images|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|gif)$).*)",
  ],
};
