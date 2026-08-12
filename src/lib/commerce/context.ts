import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, requireRole, type CurrentUser } from "@/lib/auth/dal";
import { viewerTier } from "@/lib/catalogue/pricing";
import { ROLES, type PriceTier } from "@/lib/constants";

/**
 * "Who is shopping" — resolved once, so no page or action has to remember that
 * a customer is a User *and* a Customer row, and that the price tier comes off
 * the second one.
 *
 * `CurrentUser.customerId` is nullable because a staff account has no Customer
 * row at all. Every cart, order and wishlist query needs a non-null customer
 * id, so the narrowing happens here rather than with a `!` at forty call sites.
 */

export type CustomerContext = {
  user: CurrentUser;
  userId: string;
  customerId: string;
  customerType: string;
  tier: PriceTier;
};

/** For pages. Redirects a signed-out visitor to login and staff to their home. */
export async function requireCustomer(
  returnTo?: string,
): Promise<CustomerContext> {
  const user = await requireRole([ROLES.CUSTOMER], returnTo);

  if (!user.customerId) {
    // A CUSTOMER user with no Customer row is a half-created account. Sending
    // them to register is the only route that can repair it.
    redirect("/register");
  }

  return {
    user,
    userId: user.id,
    customerId: user.customerId,
    customerType: user.customerType ?? "RETAIL",
    tier: viewerTier(user),
  };
}

/**
 * For Server Actions and the site header. Returns null instead of redirecting —
 * an action must be able to answer "you need to sign in" to the caller, and a
 * redirect thrown from inside a form submission is a confusing way to say it.
 */
export async function getCustomerContext(): Promise<CustomerContext | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.CUSTOMER || !user.customerId) return null;

  return {
    user,
    userId: user.id,
    customerId: user.customerId,
    customerType: user.customerType ?? "RETAIL",
    tier: viewerTier(user),
  };
}
