"use client";

import { useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, Heart, Minus, Plus, Trash2 } from "lucide-react";
import { cn, formatPaise } from "@/lib/utils";
import {
  moveCartItemToWishlist,
  removeCartItem,
  updateCartQuantity,
} from "@/app/actions/cart";
import { IDLE_STATE } from "@/lib/validations/commerce";
import type { CartLine as CartLineData } from "@/lib/commerce/cart";

/**
 * One row of the bag.
 *
 * The quantity control carries its value on the submit buttons themselves
 * (`name="quantity" value={n}`) rather than in component state. That keeps the
 * whole row a plain form: it works with JavaScript disabled, there is no local
 * quantity that can drift out of step with the server's answer, and a rejected
 * change (someone else took the last piece) simply leaves the displayed number
 * where it was.
 */
export function CartLine({ line }: { line: CartLineData }) {
  const [qtyState, qtyAction, qtyPending] = useActionState(
    updateCartQuantity,
    IDLE_STATE,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeCartItem,
    IDLE_STATE,
  );
  const [saveState, saveAction, savePending] = useActionState(
    moveCartItemToWishlist,
    IDLE_STATE,
  );

  const busy = qtyPending || removePending || savePending;
  const blocking = line.issues.length > 0;
  const error =
    qtyState.status === "error"
      ? qtyState.message
      : removeState.status === "error"
        ? removeState.message
        : saveState.status === "error"
          ? saveState.message
          : null;

  const canDecrease = line.quantity > line.minOrderQty;
  const canIncrease =
    line.quantity < Math.min(line.availableQty, line.maxOrderQty);

  return (
    <li
      className={cn(
        "flex gap-4 py-6 transition-opacity sm:gap-5",
        busy && "opacity-60",
      )}
    >
      <Link
        href={`/product/${line.slug}`}
        className="relative aspect-[3/4] w-20 shrink-0 overflow-hidden bg-ivory-200 sm:w-24"
      >
        {line.imageUrl ? (
          <Image
            src={line.imageUrl}
            alt={line.imageAlt}
            fill
            sizes="96px"
            className="object-cover"
          />
        ) : null}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <Link
              href={`/product/${line.slug}`}
              className="text-sm text-ink-900 hover:text-brand-600"
            >
              {line.name}
            </Link>
            {line.variantLabel && (
              <p className="mt-1 text-xs text-ink-400">{line.variantLabel}</p>
            )}
            <p className="mt-0.5 text-xs text-ink-400">SKU {line.sku}</p>
            {/* A bag can hold one piece off the shelf and one still on the
                loom. Saying so per line stops the whole order reading as if it
                ships together. */}
            {line.loomWeeks !== null && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-gold-600">
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-gold-500" />
                Woven to order · about {line.loomWeeks} weeks
              </p>
            )}
          </div>

          <div className="text-right">
            <p className="text-sm text-ink-900 tabular-nums">
              {formatPaise(line.lineTotal)}
            </p>
            {line.quantity > 1 && (
              <p className="mt-0.5 text-xs text-ink-400 tabular-nums">
                {formatPaise(line.unitPrice)} each
              </p>
            )}
            {line.price.isTradePrice && (
              <p className="mt-0.5 text-xs text-gold-500">Trade price</p>
            )}
          </div>
        </div>

        {/* ---- Issues ---- */}
        {blocking && (
          <ul className="mt-3 space-y-1">
            {line.issues.map((issue) => (
              <li
                key={issue.kind}
                className="flex items-start gap-1.5 text-xs text-danger"
              >
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-px h-3.5 w-3.5 shrink-0"
                />
                {issue.message}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="mt-3 text-xs text-danger">
            {error}
          </p>
        )}

        {/* ---- Controls ---- */}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-3 pt-4">
          <form action={qtyAction} className="flex items-center rounded-md border border-ivory-400">
            <input type="hidden" name="cartItemId" value={line.id} />

            <button
              type="submit"
              name="quantity"
              value={line.quantity - 1}
              aria-label={`Decrease quantity of ${line.name}`}
              disabled={!canDecrease || busy}
              className={STEPPER}
            >
              <Minus aria-hidden="true" className="h-3 w-3" />
            </button>

            <span className="min-w-9 px-1 text-center text-sm tabular-nums text-ink-900">
              {line.quantity}
            </span>

            <button
              type="submit"
              name="quantity"
              value={line.quantity + 1}
              aria-label={`Increase quantity of ${line.name}`}
              disabled={!canIncrease || busy}
              className={STEPPER}
            >
              <Plus aria-hidden="true" className="h-3 w-3" />
            </button>
          </form>

          {line.minOrderQty > 1 && (
            <span className="text-xs text-ink-400">
              Min {line.minOrderQty}
            </span>
          )}

          <form action={saveAction}>
            <input type="hidden" name="cartItemId" value={line.id} />
            <button type="submit" disabled={busy} className={LINK_BUTTON}>
              <Heart aria-hidden="true" className="h-3.5 w-3.5" />
              Save for later
            </button>
          </form>

          <form action={removeAction}>
            <input type="hidden" name="cartItemId" value={line.id} />
            <button
              type="submit"
              disabled={busy}
              className={cn(LINK_BUTTON, "hover:text-danger")}
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              Remove
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}

const STEPPER =
  "flex h-9 w-9 items-center justify-center text-ink-900 transition-colors " +
  "hover:bg-ivory-200 disabled:cursor-not-allowed disabled:text-ink-400/50 " +
  "disabled:hover:bg-transparent";

const LINK_BUTTON =
  "inline-flex items-center gap-1.5 text-xs text-ink-400 transition-colors " +
  "hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
