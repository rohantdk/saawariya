"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleWishlist } from "@/app/actions/wishlist";
import { IDLE_STATE } from "@/lib/validations/commerce";

/**
 * The heart badge on a catalogue card — SRS §41.
 *
 * Sits on every listing card so saving does not require opening the product
 * first. A signed-out visitor gets a link to sign in rather than a button that
 * fails silently: `toggleWishlist` already returns an error for that case, but
 * a card in a grid has nowhere to surface it.
 */
export function WishlistButton({
  productId,
  initialSaved,
  signInHref,
}: {
  productId: string;
  /** `null` means no customer is signed in — render a sign-in link instead. */
  initialSaved: boolean | null;
  signInHref: string;
}) {
  if (initialSaved === null) {
    return (
      <Link
        href={signInHref}
        aria-label="Sign in to save to wishlist"
        onClick={(e) => e.stopPropagation()}
        className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-cream/90 text-ink-900 shadow-card transition-colors hover:text-brand-600"
      >
        <Heart aria-hidden="true" className="h-4 w-4" />
      </Link>
    );
  }

  return <Toggle productId={productId} initialSaved={initialSaved} />;
}

function Toggle({
  productId,
  initialSaved,
}: {
  productId: string;
  initialSaved: boolean;
}) {
  const [state, action, pending] = useActionState(toggleWishlist, IDLE_STATE);
  const saved = state.saved ?? initialSaved;

  return (
    <form
      action={action}
      onClick={(e) => e.stopPropagation()}
      className="absolute right-3 top-3 z-10"
    >
      <input type="hidden" name="productId" value={productId} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={saved}
        aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full bg-cream/90 shadow-card transition-colors disabled:opacity-60",
          saved ? "text-brand-600" : "text-ink-900 hover:text-brand-600",
        )}
      >
        <Heart
          aria-hidden="true"
          className={cn("h-4 w-4", saved && "fill-current")}
        />
      </button>
    </form>
  );
}
