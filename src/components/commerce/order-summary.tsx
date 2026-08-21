import { Tag, Truck } from "lucide-react";
import { cn, formatPaise } from "@/lib/utils";
import type { OrderTotals } from "@/lib/commerce/totals";

/**
 * The money panel, shared by the cart, the checkout and the order confirmation
 * so all three read identically. It renders an `OrderTotals` and computes
 * nothing itself — the sums come from src/lib/commerce/totals.ts.
 */
export function OrderSummary({
  totals,
  couponCode,
  itemCount,
  children,
  className,
}: {
  totals: OrderTotals;
  couponCode?: string | null;
  itemCount: number;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border border-ivory-400 bg-ivory-50 p-6", className)}>
      <h2 className="mb-5 font-display text-xl">Summary</h2>

      <dl className="space-y-3 text-sm">
        <Row
          label={`Subtotal (${itemCount} item${itemCount === 1 ? "" : "s"})`}
          value={formatPaise(totals.subtotal)}
        />

        {totals.discountAmount > 0 && (
          <Row
            label={couponCode ? `Discount · ${couponCode}` : "Discount"}
            value={`− ${formatPaise(totals.discountAmount)}`}
            tone="success"
          />
        )}

        <Row
          label="Shipping"
          value={
            totals.shippingAmount === 0
              ? "Free"
              : formatPaise(totals.shippingAmount)
          }
          tone={totals.shippingAmount === 0 ? "success" : undefined}
        />

        {/* GST is shown as a line either way, but the wording has to say whether
            it is part of the total or added to it — the two are a 5% difference
            in what the customer pays. */}
        <Row
          label={
            totals.taxIsIncluded ? "GST (included)" : "GST"
          }
          value={
            totals.taxIsIncluded
              ? formatPaise(totals.taxAmount)
              : `+ ${formatPaise(totals.taxAmount)}`
          }
          muted={totals.taxIsIncluded}
        />

        <div className="flex items-baseline justify-between border-t border-ivory-400 pt-3">
          <dt className="font-display text-lg text-ink-900">Total</dt>
          <dd className="font-display text-lg text-ink-900">
            {formatPaise(totals.totalAmount)}
          </dd>
        </div>
      </dl>

      {totals.freeShippingShortfall > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-ivory-400 bg-ivory-100 p-3 text-xs leading-relaxed text-ink-500">
          <Truck aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Add {formatPaise(totals.freeShippingShortfall)} more to qualify for
          free shipping.
        </p>
      )}

      {couponCode && totals.discountAmount === 0 && (
        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-400">
          <Tag aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {couponCode} applied — free shipping.
        </p>
      )}

      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  muted,
}: {
  label: string;
  value: string;
  tone?: "success";
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn("text-ink-400", muted && "text-ink-400/80")}>{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          tone === "success" ? "text-success" : "text-ink-900",
          muted && "text-ink-400",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
