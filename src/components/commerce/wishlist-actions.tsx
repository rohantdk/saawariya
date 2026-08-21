"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import {
  moveWishlistItemToCart,
  removeWishlistItem,
} from "@/app/actions/wishlist";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button, ButtonLink } from "@/components/ui/button";

/**
 * The two things you can do with a saved item.
 *
 * A product with variants gets a link to its page rather than a "move to bag"
 * button: nobody has chosen a length or size, and picking one for the customer
 * puts the wrong item in a real order. The wishlist row does not know which
 * variant they wanted, so it must not guess.
 */
export function WishlistActions({
  productId,
  slug,
  canAddToBag,
  hasVariants,
}: {
  productId: string;
  slug: string;
  canAddToBag: boolean;
  hasVariants: boolean;
}) {
  const [moveState, moveAction, movePending] = useActionState(
    moveWishlistItemToCart,
    IDLE_STATE,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeWishlistItem,
    IDLE_STATE,
  );

  const error =
    moveState.status === "error"
      ? moveState.message
      : removeState.status === "error"
        ? removeState.message
        : null;

  return (
    <div className="space-y-2">
      {canAddToBag ? (
        hasVariants ? (
          <ButtonLink
            href={`/product/${slug}`}
            size="sm"
            className="w-full"
          >
            Choose options
          </ButtonLink>
        ) : (
          <form action={moveAction}>
            <input type="hidden" name="productId" value={productId} />
            <Button
              type="submit"
              size="sm"
              disabled={movePending}
              className="w-full"
            >
              {movePending ? "Moving…" : "Move to bag"}
            </Button>
          </form>
        )
      ) : (
        <Link
          href={`/product/${slug}`}
          className="block w-full rounded-md border border-ink-900/15 px-4 py-2.5 text-center text-xs font-medium uppercase tracking-[0.12em] text-ink-400"
        >
          View piece
        </Link>
      )}

      <form action={removeAction}>
        <input type="hidden" name="productId" value={productId} />
        <button
          type="submit"
          disabled={removePending}
          className="flex w-full items-center justify-center gap-1.5 py-2 text-xs text-ink-400 transition-colors hover:text-danger disabled:opacity-50"
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          Remove
        </button>
      </form>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
