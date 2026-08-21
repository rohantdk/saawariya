import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { getSellerProfile } from "@/lib/seller/profile";
import { PanelShell } from "@/components/layout/panel-shell";
import { SellerProfileForm } from "@/components/seller/profile-form";
import { ROLES, SELLER_VERIFICATION } from "@/lib/constants";

export const metadata: Metadata = { title: "Seller application" };

/**
 * Seller onboarding — SRS §54.
 *
 * Reachable in two situations, and it handles both rather than being two pages:
 * a SELLER user with no Seller row at all (first sign-in), and an unapproved
 * seller coming back from `/seller/pending` to correct their application.
 *
 * Gated on the role only, never on `requireSeller()`: this is the page that
 * *creates* the row that gate requires, so gating it would make it unreachable.
 * It sits outside the `(panel)` group for the same reason — the sidebar is
 * entirely made of screens this user cannot open yet.
 */
export default async function SellerOnboardingPage() {
  const user = await requireRole([ROLES.SELLER], "/seller/onboarding");

  const profile = user.sellerId ? await getSellerProfile(user.sellerId) : null;

  // An approved seller editing their business belongs on the real profile
  // screen, inside the panel, with their navigation around them.
  if (profile?.verificationStatus === SELLER_VERIFICATION.APPROVED) {
    redirect("/seller/profile");
  }

  const isEditing = Boolean(profile);

  return (
    <PanelShell user={user}>
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow mb-5">Seller registration</p>
        <h1 className="mb-3 font-display text-4xl">
          {isEditing ? "Edit your application" : "Sell on Saawariya"}
        </h1>
        <p className="mb-10 max-w-xl text-sm leading-relaxed text-ink-400">
          {isEditing
            ? "Update your business details and resubmit. Our verification team will review the changes."
            : "Tell us about your business. Once your details and KYC documents are verified you can list products and start receiving orders."}
        </p>

        <SellerProfileForm
          profile={profile}
          submitLabel={isEditing ? "Save and resubmit" : "Submit application"}
        />
      </div>
    </PanelShell>
  );
}
