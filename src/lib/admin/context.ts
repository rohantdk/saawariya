import "server-only";
import {
  getCurrentUser,
  requireRole,
  type CurrentUser,
} from "@/lib/auth/dal";
import {
  ROLE_PERMISSIONS,
  roleHas,
  type Permission,
} from "@/lib/auth/permissions";
import { ROLES, type RoleCode } from "@/lib/constants";

/**
 * "Which admin is acting" — the counterpart to `src/lib/seller/context.ts`.
 *
 * The console at `/admin` is the **Super Admin** area specifically. Finance,
 * Support and Marketing are also allowed into `/admin/*` by the proxy (they own
 * `/admin/finance`, `/admin/support` and `/admin/marketing`), so the console
 * needs its own gate — `requireRole` sends those three to their own sections
 * rather than to `/login`, which would look like a broken session.
 *
 * `permissions` rides on the context for the same reason it does on the seller
 * side: sub-order overrides go through `assertTransition`, which takes a
 * permission list, and every mutation here re-checks a permission rather than a
 * role. SUPER_ADMIN holds all of them by construction, so this is not currently
 * a narrowing — it is what keeps the actions honest if the console is ever
 * opened to a narrower role.
 */

export type AdminContext = {
  user: CurrentUser;
  userId: string;
  permissions: readonly Permission[];
};

/** For pages under the `(console)` route group. Redirects. */
export async function requireAdmin(returnTo?: string): Promise<AdminContext> {
  const user = await requireRole([ROLES.SUPER_ADMIN], returnTo);

  return {
    user,
    userId: user.id,
    permissions: ROLE_PERMISSIONS[user.role] ?? [],
  };
}

/**
 * For the Finance, Marketing and Support desks — Phase 8.
 *
 * Those three sit *outside* the `(console)` group, at `/admin/finance`,
 * `/admin/marketing` and `/admin/support`, because this file's `requireAdmin`
 * redirects them to exactly those pages. They admit their own role alongside
 * `SUPER_ADMIN`, which is the same construction `requireOperations` uses for the
 * three operations desks and for the same reason: an admin holds every
 * permission, so they can work any desk without a magic branch.
 *
 * No route group is needed *around* the three, unlike `(console)` and
 * `/seller/(panel)`: a wrong-role user is sent to a **different** area — a
 * Marketing user arriving at `/admin/finance` lands on `/admin/marketing` — so
 * there is no page that redirects to itself.
 */
export async function requireDesk(
  desk: RoleCode,
  returnTo?: string,
): Promise<AdminContext> {
  const user = await requireRole([desk, ROLES.SUPER_ADMIN], returnTo);

  return {
    user,
    userId: user.id,
    permissions: ROLE_PERMISSIONS[user.role] ?? [],
  };
}

/**
 * For Server Actions. Returns a result instead of redirecting — an action has
 * to answer the form that called it, and a navigation thrown out of a
 * submission is a confusing way to say "you are not allowed to do that".
 *
 * Takes the permission the action needs rather than assuming the role, so the
 * check is stated at every call site and reads the same as the seller actions.
 * That is also what lets the Finance, Marketing and Support desks share it
 * rather than each growing a near-identical copy: a Finance user holds
 * `SETTLEMENT_RELEASE` and no other role does, so the permission *is* the check.
 * "Admin" here means the back office at `/admin`, not the Super Admin role.
 */
export async function requireAdminAction(
  permission: Permission,
): Promise<
  { ok: true; admin: AdminContext } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to do that." };
  }
  if (!roleHas(user.role, permission)) {
    return { ok: false, error: "You do not have permission to do that." };
  }

  return {
    ok: true,
    admin: {
      user,
      userId: user.id,
      permissions: ROLE_PERMISSIONS[user.role] ?? [],
    },
  };
}
