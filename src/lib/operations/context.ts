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
 * "Which operations desk is acting" — the counterpart to
 * `src/lib/seller/context.ts` and `src/lib/admin/context.ts`.
 *
 * One context serves all three panels rather than three near-identical copies,
 * because they differ only in which roles may enter. What they do *not* differ
 * in is the important part: every one of them moves sub-orders through
 * `assertTransition`, which takes a permission list, so `permissions` rides on
 * the context exactly as it does on the seller and admin sides.
 *
 * `SUPER_ADMIN` is admitted to all three. That is not a courtesy — it is the
 * same construction the state machine relies on everywhere else: an admin holds
 * every permission, so they can unstick any desk without a magic branch. Their
 * `ROLE_HOME` is still `/admin`, so they arrive here only by choosing to.
 */

export type OperationsContext = {
  user: CurrentUser;
  userId: string;
  role: RoleCode;
  permissions: readonly Permission[];
  /** True when the viewer is standing in rather than working their own desk. */
  isStandIn: boolean;
};

function contextFor(user: CurrentUser, desk: RoleCode): OperationsContext {
  return {
    user,
    userId: user.id,
    role: user.role,
    permissions: ROLE_PERMISSIONS[user.role] ?? [],
    isStandIn: user.role !== desk,
  };
}

/**
 * For pages under one operations desk. Redirects.
 *
 * A Warehouse user reaching `/operations/qc` passes the proxy — it gates the
 * whole `/operations` area on `OPERATIONS_ROLES` and nothing finer — and is
 * stopped here, landing back on their own desk rather than at `/login`. That
 * split is the one verified in Phase 1 and it is deliberately unchanged.
 */
export async function requireOperations(
  desk: RoleCode,
  returnTo?: string,
): Promise<OperationsContext> {
  const user = await requireRole([desk, ROLES.SUPER_ADMIN], returnTo);
  return contextFor(user, desk);
}

/**
 * For Server Actions. Returns a result instead of redirecting — an action has
 * to answer the form that called it.
 *
 * Takes the *permission* the action needs, not the desk, for the same reason
 * the transitions do: `SUPER_ADMIN` holds all of them, and a role check here
 * would be a second, drifting copy of the RBAC matrix.
 */
export async function requireOperationsAction(
  permission: Permission,
): Promise<
  { ok: true; ops: OperationsContext } | { ok: false; error: string }
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
    ops: {
      user,
      userId: user.id,
      role: user.role,
      permissions: ROLE_PERMISSIONS[user.role] ?? [],
      isStandIn: false,
    },
  };
}
