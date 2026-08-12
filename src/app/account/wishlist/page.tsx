import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { requireCustomer } from "@/lib/commerce/context";
import { getWishlist } from "@/lib/commerce/wishlist";
import { Price } from "@/components/storefront/price";
import { WishlistActions } from "@/components/commerce/wishlist-actions";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "My wishlist" };

/**
 * Saved items — SRS §41.
 *
 * Items that can no longer be bought stay on the list and say why, rather than
 * disappearing. A wishlist is a record of what someone liked; silently deleting
 * rows from it looks like the site lost their data.
 */
export default async function WishlistPage() {
  const customer = await requireCustomer("/account/wishlist");
  const items = await getWishlist(customer.customerId, customer.tier);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl sm:text-4xl">My wishlist</h1>
      <p className="mt-2 text-sm text-ink-400">
        {items.length === 0
          ? "Save pieces you like and they will wait for you here."
          : `${items.length} saved piece${items.length === 1 ? "" : "s"}.`}
      </p>

      {items.length === 0 ? (
        <div className="mt-8 border border-ivory-400 bg-ivory-50 p-10 text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ivory-200 text-ink-400"
          >
            <Heart className="h-5 w-5" />
          </span>
          <p className="text-sm text-ink-400">Nothing saved yet.</p>
          <ButtonLink href="/shop" className="mt-5">
            Browse the shop
          </ButtonLink>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {items.map((item) => (
            <li
              key={item.productId}
              className="flex flex-wrap gap-5 border border-ivory-400 bg-ivory-50 p-4 sm:flex-nowrap"
            >
              <Link
                href={`/product/${item.slug}`}
                className="relative aspect-[3/4] w-20 shrink-0 overflow-hidden bg-ivory-200"
              >
                {item.imageUrl && (
                  <Image
                    src={item.imageUrl}
                    alt={item.imageAlt}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/product/${item.slug}`}
                  className="text-sm text-ink-900 hover:text-brand-600"
                >
                  {item.name}
                </Link>
                <p className="mt-1 text-xs text-ink-400">
                  {item.sellerName} · saved {formatDate(item.addedAt)}
                </p>

                <div className="mt-2.5">
                  <Price price={item.price} size="sm" />
                </div>

                {!item.isBuyable ? (
                  <p className="mt-2 text-xs text-danger">
                    No longer available on Saawariya.
                  </p>
                ) : item.isOutOfStock ? (
                  <p className="mt-2 text-xs text-warning">
                    Out of stock — we will restock when the weaver delivers.
                  </p>
                ) : null}
              </div>

              <div className="w-full shrink-0 sm:w-44">
                <WishlistActions
                  productId={item.productId}
                  slug={item.slug}
                  canAddToBag={item.isBuyable && !item.isOutOfStock}
                  hasVariants={item.hasVariants}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
