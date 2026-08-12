import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { roleHas, roleHasAny, type Permission } from "@/lib/auth/permissions";
import { ROLE_HOME, USER_STATUS, type RoleCode } from "@/lib/constants";

/**
 * Data Access Layer — the authoritative authorisation boundary.
 *
 * Every protected read and every mutation goes through here. src/proxy.ts does
 * an optimistic cookie check to keep unauthenticated users out of the routing
 * layer, but it is a convenience, not a security control: Server Actions and
 * Route Handlers are reachable directly regardless of what the proxy allowed.
 *
 * Two rules this file exists to enforce:
 *   1. Session validity is re-checked against the database, not just the cookie.
 *      A user suspended after signing in must lose access on their next request.
 *   2. The returned object is a DTO. `passwordHash` is never selected, so it
 *      cannot leak into a Server Component payload by accident.
 *
 * `cache()` memoises per render pass, so calling getCurrentUser() in a layout
 * and again in three nested components costs one query, not four.
 */

export type CurrentUser = {
  id: string;
  email: string;
  mobile: string | null;
  fullName: string;
  avatarUrl: string | null;
  role: RoleCode;
  status: string;
  sellerId: string | null;
  sellerStatus: string | null;
  customerId: string | null;
  customerType: string | null;
};

/**
 * Returns the signed-in user, or null. Never redirects.
 * Use on public pages that merely render differently when signed in.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    // Explicit column selection — passwordHash is deliberately absent.
    select: {
      id: true,
      email: true,
      mobile: true,
      fullName: true,
      avatarUrl: true,
      roleCode: true,
      status: true,
      seller: { select: { id: true, verificationStatus: true } },
      customer: { select: { id: true, customerType: true } },
    },
  });

  // Deleted since the cookie was issued, or suspended by an admin.
  if (!user || user.status === USER_STATUS.SUSPENDED) return null;

  return {
    id: user.id,
    email: user.email,
    mobile: user.mobile,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    role: user.roleCode as RoleCode,
    status: user.status,
    sellerId: user.seller?.id ?? null,
    sellerStatus: user.seller?.verificationStatus ?? null,
    customerId: user.customer?.id ?? null,
    customerType: user.customer?.customerType ?? null,
  };
});

/**
 * Requires a signed-in user. Redirects to /login otherwise.
 * `next` preserves where they were heading so login can return them there.
 */
export const requireUser = cache(
  async (returnTo?: string): Promise<CurrentUser> => {
    const user = await getCurrentUser();
    if (!user) {
      const target = returnTo
        ? `/login?next=${encodeURIComponent(returnTo)}`
        : "/login";
      redirect(target);
    }
    return user;
  },
);

/**
 * Requires one of the given roles. Sends an authenticated-but-wrong-role user
 * to their own home rather than to /login, which would be a confusing dead end.
 */
export async function requireRole(
  allowed: RoleCode[],
  returnTo?: string,
): Promise<CurrentUser> {
  const user = await requireUser(returnTo);
  if (!allowed.includes(user.role)) {
    redirect(ROLE_HOME[user.role] ?? "/");
  }
  return user;
}

/** Requires a specific permission from the RBAC matrix. */
export async function requirePermission(
  permission: Permission,
  returnTo?: string,
): Promise<CurrentUser> {
  const user = await requireUser(returnTo);
  if (!roleHas(user.role, permission)) {
    redirect(ROLE_HOME[user.role] ?? "/");
  }
  return user;
}

/** Requires at least one of the given permissions. */
export async function requireAnyPermission(
  permissions: Permission[],
  returnTo?: string,
): Promise<CurrentUser> {
  const user = await requireUser(returnTo);
  if (!roleHasAny(user.role, permissions)) {
    redirect(ROLE_HOME[user.role] ?? "/");
  }
  return user;
}

/**
 * Non-redirecting permission check, for Server Actions.
 *
 * Actions must return an error to the caller rather than redirect, so this
 * reports a result instead of throwing a navigation.
 */
export async function checkPermission(
  permission: Permission,
): Promise<{ ok: true; user: CurrentUser } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in to do that." };
  if (!roleHas(user.role, permission)) {
    return { ok: false, error: "You do not have permission to do that." };
  }
  return { ok: true, user };
}

/**
 * A seller whose application has not been approved can sign in and complete
 * their profile, but must not reach product or order management (SRS §55, §68).
 */
export async function requireApprovedSeller(
  returnTo?: string,
): Promise<CurrentUser & { sellerId: string }> {
  const user = await requireRole(["SELLER"], returnTo);
  if (!user.sellerId) redirect("/seller/onboarding");
  if (user.sellerStatus !== "APPROVED") redirect("/seller/pending");
  return user as CurrentUser & { sellerId: string };
}
