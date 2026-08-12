import "server-only";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  requireRole,
  type CurrentUser,
} from "@/lib/auth/dal";
import { ROLE_PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { ROLES, SELLER_VERIFICATION } from "@/lib/constants";

/**
 * "Which seller is acting" — resolved once, for the same reason
 * `src/lib/commerce/context.ts` exists on the customer side: a seller is a User
 * *and* a Seller row, and every catalogue, stock, order and settlement query
 * needs a non-null seller id. Narrowing here beats a `!` at fifty call sites.
 *
 * `permissions` is carried on the context because every sub-order transition
 * goes through `assertTransition`, which takes a permission list. Reading it off
 * the role once per request keeps the state machine pure and stops each action
 * re-deriving it.
 */

export type SellerContext = {
  user: CurrentUser;
  userId: string;
  sellerId: string;
  verificationStatus: string;
  permissions: readonly Permission[];
};

/**
 * For pages under `/seller` that manage a live business.
 *
 * Mirrors `requireApprovedSeller()` in the DAL — an unapproved seller may sign
 * in and finish their profile, but must not reach catalogue or orders (SRS §55,
 * §68). The two redirect targets are real pages: `/seller/onboarding` for a
 * user with no Seller row, `/seller/pending` for one awaiting verification.
 */
export async function requireSeller(returnTo?: string): Promise<SellerContext> {
  const user = await requireRole([ROLES.SELLER], returnTo);

  if (!user.sellerId) redirect("/seller/onboarding");
  if (user.sellerStatus !== SELLER_VERIFICATION.APPROVED) {
    redirect("/seller/pending");
  }

  return {
    user,
    userId: user.id,
    sellerId: user.sellerId,
    verificationStatus: user.sellerStatus,
    permissions: ROLE_PERMISSIONS[user.role] ?? [],
  };
}

/**
 * For the profile and onboarding screens, which are precisely the pages an
 * unapproved seller *is* allowed to use. Returns the context without the
 * approval gate; callers must not use it to reach catalogue or order data.
 */
export async function requireSellerAccount(
  returnTo?: string,
): Promise<SellerContext> {
  const user = await requireRole([ROLES.SELLER], returnTo);
  if (!user.sellerId) redirect("/seller/onboarding");

  return {
    user,
    userId: user.id,
    sellerId: user.sellerId,
    verificationStatus: user.sellerStatus ?? SELLER_VERIFICATION.PENDING,
    permissions: ROLE_PERMISSIONS[user.role] ?? [],
  };
}

/**
 * For Server Actions. Returns null rather than redirecting, because an action
 * has to answer the caller — a navigation thrown out of a form submission is a
 * confusing way to say "you are not allowed to do that".
 */
export async function getSellerContext(): Promise<SellerContext | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.SELLER || !user.sellerId) return null;
  if (user.sellerStatus !== SELLER_VERIFICATION.APPROVED) return null;

  return {
    user,
    userId: user.id,
    sellerId: user.sellerId,
    verificationStatus: user.sellerStatus,
    permissions: ROLE_PERMISSIONS[user.role] ?? [],
  };
}
