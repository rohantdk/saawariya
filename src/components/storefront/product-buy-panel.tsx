"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Heart, Minus, Plus, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { INVENTORY_STATUS, type PriceTier } from "@/lib/constants";
import { resolvePrice } from "@/lib/catalogue/pricing";
import { addToCart } from "@/app/actions/cart";
import { toggleWishlist } from "@/app/actions/wishlist";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Price,
  TradePriceNote,
  WholesaleTeaser,
} from "@/components/storefront/price";

export type BuyPanelVariant = {
  id: string;
  name: string;
  value: string;
  sku: string;
  priceDeltaPaise: number;
  stockQty: number;
};

/**
 * Price, variant selection, quantity and the two buttons that put a product
 * into an order.
 *
 * This is a client component because the selection is genuinely interactive
 * state: choosing a variant changes the price (`priceDeltaPaise` is a real
 * difference — a 6.3 metre saree costs ₹450 more than the 5.5 metre one), the
 * stock line, and the ceiling on the quantity stepper. All three have to move
 * together, so they share one component.
 *
 * A signed-out visitor gets a link to sign in rather than a button that fails.
 * A cart belongs to a Customer row, so there is nowhere to put an anonymous
 * one, and a button whose only outcome is an error message is worse than an
 * honest sign-in prompt.
 */
export function ProductBuyPanel({
  productId,
  product,
  variants,
  tier,
  inventory,
  canPurchase,
  signInHref,
  isWishlisted,
}: {
  productId: string;
  product: {
    priceRetail: number;
    priceOffer: number | null;
    priceWholesale: number | null;
    minOrderQty: number;
    maxOrderQty: number;
  };
  variants: BuyPanelVariant[];
  tier: PriceTier;
  inventory: {
    status: string;
    stockQty: number;
    reservedQty: number;
    lowStockThreshold: number;
  } | null;
  canPurchase: boolean;
  signInHref: string;
  isWishlisted: boolean;
}) {
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? null);
  const selected = variants.find((v) => v.id === selectedId) ?? null;
  const delta = selected?.priceDeltaPaise ?? 0;

  // The delta applies to whichever tier the viewer is on, so it is added to
  // every price column before the tier is resolved rather than to the result.
  const price = resolvePrice(
    {
      priceRetail: product.priceRetail + delta,
      priceOffer: product.priceOffer === null ? null : product.priceOffer + delta,
      priceWholesale:
        product.priceWholesale === null ? null : product.priceWholesale + delta,
      minOrderQty: product.minOrderQty,
    },
    tier,
  );

  // Product stock less what other placed orders are holding, then capped by the
  // chosen variant's own stock. Mirrors availableFor() in src/lib/commerce/cart.ts.
  const unreserved = inventory
    ? Math.max(0, inventory.stockQty - inventory.reservedQty)
    : 0;
  const availableQty = selected
    ? Math.max(0, Math.min(selected.stockQty, unreserved))
    : unreserved;

  const threshold = inventory?.lowStockThreshold ?? 5;
  const isOutOfStock =
    availableQty <= 0 ||
    inventory?.status === INVENTORY_STATUS.OUT_OF_STOCK ||
    inventory?.status === INVENTORY_STATUS.DISCONTINUED;
  const isLowStock = !isOutOfStock && availableQty <= threshold;

  const minQty = price.minOrderQty;
  const maxQty = Math.max(minQty, Math.min(availableQty, product.maxOrderQty));
  // A trade account looking at a 25-metre MOQ with 10 metres in stock cannot
  // buy at all; saying so is better than a stepper that refuses to move.
  const belowMoq = !isOutOfStock && availableQty < minQty;

  const [quantity, setQuantity] = useState(minQty);
  // React 19 lints setState inside an effect. Re-clamping during render against
  // a copy of the previous variant is the supported way to reset derived state
  // when a prop-like value changes — see the note in AGENTS.md lineage.
  const [lastVariantId, setLastVariantId] = useState(selectedId);
  if (lastVariantId !== selectedId) {
    setLastVariantId(selectedId);
    setQuantity(Math.min(Math.max(minQty, quantity), maxQty));
  }

  const [cartState, addAction, addPending] = useActionState(
    addToCart,
    IDLE_STATE,
  );
  const [wishState, wishAction, wishPending] = useActionState(
    toggleWishlist,
    IDLE_STATE,
  );

  // The server is authoritative once it has answered; before that, the prop.
  const saved = wishState.saved ?? isWishlisted;

  const variantLabel = variants[0]?.name ?? "Option";

  return (
    <div>
      <Price price={price} size="lg" />
      <TradePriceNote price={price} />
      {!price.isTradePrice && (
        <div className="mt-1.5">
          <WholesaleTeaser
            hasWholesalePrice={product.priceWholesale !== null}
            minOrderQty={product.minOrderQty}
          />
        </div>
      )}
      <p className="mt-2 text-xs text-ink-400">
        Inclusive of all taxes. Shipping calculated at checkout.
      </p>

      {variants.length > 0 && (
        <fieldset className="mt-7">
          <legend className="mb-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
            {variantLabel}
          </legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => {
              const isSelected = variant.id === selectedId;
              const isSoldOut = variant.stockQty <= 0;

              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedId(variant.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "border px-4 py-2.5 text-sm transition-colors",
                    isSelected
                      ? "border-brand-600 bg-brand-600 text-ivory-50"
                      : "border-ivory-400 text-ink-900 hover:border-ink-400",
                    // Sold-out variants stay selectable so the price and the
                    // reason are still visible — hiding them just makes a
                    // product look like it has fewer options than it has.
                    isSoldOut && !isSelected && "text-ink-400 line-through",
                  )}
                >
                  {variant.value}
                  {variant.priceDeltaPaise > 0 && (
                    <span
                      className={cn(
                        "ml-1.5 text-xs",
                        isSelected ? "text-ivory-100/80" : "text-ink-400",
                      )}
                    >
                      +₹{(variant.priceDeltaPaise / 100).toLocaleString("en-IN")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {selected && (
            <p className="mt-2 text-xs text-ink-400">SKU {selected.sku}</p>
          )}
        </fieldset>
      )}

      <div className="mt-7 border-t border-ivory-400 pt-5">
        {isOutOfStock ? (
          <p className="flex items-center gap-2 text-sm text-danger">
            <Dot className="bg-danger" />
            Out of stock
          </p>
        ) : isLowStock ? (
          <p className="flex items-center gap-2 text-sm text-warning">
            <Dot className="bg-warning" />
            Only {availableQty} left
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-success">
            <Dot className="bg-success" />
            In stock · {availableQty} available
          </p>
        )}
      </div>

      {price.isTradePrice && minQty > 1 && (
        <p className="mt-3 text-xs text-ink-400">
          Minimum order {minQty} units at trade pricing.
        </p>
      )}

      {/* ---- Quantity + add to bag ---- */}
      {canPurchase ? (
        <form action={addAction} className="mt-6">
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="variantId" value={selectedId ?? ""} />
          <input type="hidden" name="quantity" value={quantity} />

          <div className="flex flex-wrap items-stretch gap-3">
            <div className="flex items-center border border-ivory-400">
              <StepperButton
                label="Decrease quantity"
                disabled={isOutOfStock || belowMoq || quantity <= minQty}
                onClick={() => setQuantity((q) => Math.max(minQty, q - 1))}
              >
                <Minus aria-hidden="true" className="h-3.5 w-3.5" />
              </StepperButton>

              <span
                aria-live="polite"
                className="min-w-12 px-2 text-center text-sm tabular-nums text-ink-900"
              >
                {quantity}
              </span>

              <StepperButton
                label="Increase quantity"
                disabled={isOutOfStock || belowMoq || quantity >= maxQty}
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              >
                <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              </StepperButton>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isOutOfStock || belowMoq || addPending}
              className="flex-1"
            >
              <ShoppingBag aria-hidden="true" className="h-4 w-4" />
              {addPending ? "Adding…" : isOutOfStock ? "Out of stock" : "Add to bag"}
            </Button>
          </div>

          {belowMoq && (
            <p className="mt-3 text-sm text-warning" role="status">
              Only {availableQty} in stock, below the {minQty}-unit trade
              minimum. Contact us for a restock date.
            </p>
          )}

          {cartState.status !== "idle" && cartState.message && (
            <p
              role="status"
              className={cn(
                "mt-3 text-sm",
                cartState.status === "error" ? "text-danger" : "text-success",
              )}
            >
              {cartState.message}
              {cartState.status === "success" && (
                <Link
                  href="/cart"
                  className="ml-2 underline underline-offset-4 hover:text-brand-600"
                >
                  View bag
                </Link>
              )}
            </p>
          )}
        </form>
      ) : (
        <div className="mt-6">
          <ButtonLink size="lg" className="w-full" href={signInHref}>
            <ShoppingBag aria-hidden="true" className="h-4 w-4" />
            Sign in to buy
          </ButtonLink>
          <p className="mt-2.5 text-xs text-ink-400">
            Your bag is saved to your account, so it is waiting for you on any
            device.
          </p>
        </div>
      )}

      {/* ---- Wishlist ---- */}
      {canPurchase ? (
        <form action={wishAction} className="mt-3">
          <input type="hidden" name="productId" value={productId} />
          <button
            type="submit"
            disabled={wishPending}
            aria-pressed={saved}
            className={cn(
              "flex w-full items-center justify-center gap-2 border px-6 py-3 text-xs font-medium uppercase tracking-[0.14em] transition-colors disabled:opacity-60",
              saved
                ? "border-brand-600 text-brand-600"
                : "border-ink-900/15 text-ink-900 hover:border-ink-900/40",
            )}
          >
            <Heart
              aria-hidden="true"
              className={cn("h-4 w-4", saved && "fill-current")}
            />
            {saved ? "Saved to wishlist" : "Save to wishlist"}
          </button>
        </form>
      ) : (
        <Link
          href={signInHref}
          className="mt-3 flex w-full items-center justify-center gap-2 border border-ink-900/15 px-6 py-3 text-xs font-medium uppercase tracking-[0.14em] text-ink-900 transition-colors hover:border-ink-900/40"
        >
          <Heart aria-hidden="true" className="h-4 w-4" />
          Save to wishlist
        </Link>
      )}
    </div>
  );
}

function StepperButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-13 w-11 items-center justify-center text-ink-900 transition-colors hover:bg-ivory-200 disabled:cursor-not-allowed disabled:text-ink-400/50 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function Dot({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", className)}
    />
  );
}
