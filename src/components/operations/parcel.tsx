import Image from "next/image";
import Link from "next/link";
import { StatusBadge } from "@/components/commerce/status-badge";
import {
  SUB_ORDER_STATUS_LABEL,
  subOrderTone,
} from "@/lib/commerce/order-status";
import {
  parseChecklist,
  rejectionReasonLabel,
} from "@/lib/operations/checklist";
import type { OperationsSubOrder } from "@/lib/operations/queues";
import {
  PAYMENT_METHOD_LABEL,
  SHIPMENT_STATUS_LABEL,
  type PaymentMethod,
  type ShipmentStatus,
} from "@/lib/constants";
import { availableQty } from "@/lib/inventory-status";
import { formatDateTime, formatPaise } from "@/lib/utils";

/**
 * The parts of one parcel, shared by all three operations detail pages.
 *
 * Each desk assembles the ones it needs rather than seeing a single fixed
 * layout: the warehouse wants the pick list and the shelf position, QC wants
 * the inspection history, logistics wants the courier's own event trail. What
 * none of them gets is a different *version* of the same panel, which is how
 * three screens end up disagreeing about what a parcel contains.
 */

export function ParcelHeader({
  parcel,
  backHref,
  backLabel,
}: {
  parcel: OperationsSubOrder;
  backHref: string;
  backLabel: string;
}) {
  return (
    <header className="mb-6">
      <Link
        href={backHref}
        className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
      >
        ← {backLabel}
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl">{parcel.subOrderNumber}</h1>
          <p className="mt-1 text-sm text-ink-400">
            {parcel.seller.businessName} · part of{" "}
            <Link
              href={`/admin/orders/${parcel.order.orderNumber}`}
              className="underline-offset-4 hover:underline"
            >
              {parcel.order.orderNumber}
            </Link>{" "}
            · placed {formatDateTime(parcel.order.placedAt)}
          </p>
        </div>
        <StatusBadge
          label={SUB_ORDER_STATUS_LABEL[parcel.status] ?? parcel.status}
          tone={subOrderTone(parcel.status)}
        />
      </div>
    </header>
  );
}

export function Panel({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-ivory-400 bg-ivory-50 p-5 ${className ?? ""}`}>
      <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
        {title}
      </h2>
      {hint && <p className="mt-2 text-xs leading-relaxed text-ink-400">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * The lines to be picked.
 *
 * `showStock` adds what is on the shelf behind each line, which is the
 * warehouse's actual question — a line for 10 against 12 in stock with 10
 * already reserved is the shortage they are about to walk into.
 */
export function ParcelItems({
  parcel,
  showStock = false,
}: {
  parcel: OperationsSubOrder;
  showStock?: boolean;
}) {
  return (
    <ul className="divide-y divide-ivory-300">
      {parcel.items.map((item) => {
        // `variantId` is a column, not a relation — the variant may have been
        // deleted since the order was placed, in which case the line simply
        // shows nothing rather than failing to render.
        const variant = item.variantId
          ? item.product.variants.find((v) => v.id === item.variantId)
          : null;
        const inventory = item.product.inventory;

        return (
          <li key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
            {item.imageUrl && (
              <Image
                src={item.imageUrl}
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 object-cover"
              />
            )}

            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink-900">{item.productName}</p>
              <p className="mt-0.5 text-xs text-ink-400">
                {item.productSku}
                {variant && ` · ${variant.name}: ${variant.value}`}
                {item.product.fabric && ` · ${item.product.fabric}`}
                {item.product.color && ` · ${item.product.color}`}
              </p>

              {showStock && (
                <p className="mt-1 text-xs text-ink-500">
                  {inventory
                    ? `${inventory.stockQty} on the shelf · ${inventory.reservedQty} reserved · ${availableQty(inventory)} free`
                    : "No stock record for this product."}
                </p>
              )}
            </div>

            <div className="shrink-0 text-right">
              <p className="font-display text-xl text-ink-900">
                {item.quantity}
              </p>
              <p className="text-xs text-ink-400">
                {formatPaise(item.lineTotal)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The delivery address, in full.
 *
 * The seller sees only name, city, state and PIN — under the platform-warehouse
 * model they never touch the parcel, so handing them a customer's street
 * address is a privacy leak with no operational purpose. Operations *does* ship
 * it, so this is where the address earns its place.
 */
export function DeliveryAddress({ parcel }: { parcel: OperationsSubOrder }) {
  const { order } = parcel;
  const payment = order.payments[0];

  return (
    <div className="text-sm leading-relaxed text-ink-900">
      <p>{order.shipShippingName}</p>
      <p className="text-ink-500">{order.shipLine1}</p>
      {order.shipLine2 && <p className="text-ink-500">{order.shipLine2}</p>}
      <p className="text-ink-500">
        {order.shipCity}, {order.shipState} {order.shipPinCode}
      </p>
      <p className="text-ink-500">{order.shipCountry}</p>
      <p className="mt-3 text-ink-500">{order.shipMobile}</p>

      {payment && (
        <p className="mt-4 border-t border-ivory-300 pt-3 text-xs text-ink-400">
          {PAYMENT_METHOD_LABEL[payment.method as PaymentMethod] ??
            payment.method}{" "}
          · {payment.status.toLowerCase()} ·{" "}
          {formatPaise(parcel.totalAmount)} due on this parcel
          {payment.method === "COD" && payment.status === "PENDING" && (
            <span className="mt-1 block text-warning">
              Collect on delivery — do not release without payment.
            </span>
          )}
        </p>
      )}
    </div>
  );
}

/** Every move this parcel has made, oldest first. */
export function ParcelTimeline({ parcel }: { parcel: OperationsSubOrder }) {
  if (parcel.events.length === 0) {
    return <p className="text-xs text-ink-400">Nothing recorded yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {parcel.events.map((event) => (
        <li key={event.id} className="flex gap-3">
          <span
            aria-hidden="true"
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400"
          />
          <div className="min-w-0">
            <p className="text-sm text-ink-900">
              {SUB_ORDER_STATUS_LABEL[event.toStatus] ?? event.toStatus}
              {event.fromStatus === event.toStatus && (
                <span className="text-ink-400"> · note</span>
              )}
            </p>
            {event.note && (
              <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
                {event.note}
              </p>
            )}
            <p className="mt-0.5 text-[0.6875rem] uppercase tracking-[0.1em] text-ink-400">
              {event.actorRole.toLowerCase().replace(/_/g, " ")} ·{" "}
              {formatDateTime(event.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Past inspections, newest first, with the checklist each one recorded. */
export function QcHistory({ parcel }: { parcel: OperationsSubOrder }) {
  if (parcel.qcInspections.length === 0) {
    return (
      <p className="text-xs text-ink-400">
        This parcel has not been inspected before.
      </p>
    );
  }

  return (
    <ol className="space-y-5">
      {parcel.qcInspections.map((inspection) => {
        const groups = parseChecklist(inspection.checklistJson);
        const failedItems = groups.flatMap((group) =>
          group.items.filter((item) => !item.ok).map((item) => item.label),
        );

        return (
          <li
            key={inspection.id}
            className="border-b border-ivory-300 pb-5 last:border-b-0 last:pb-0"
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={inspection.result === "PASSED" ? "Passed" : "Failed"}
                tone={inspection.result === "PASSED" ? "success" : "danger"}
              />
              {inspection.isReinspection && (
                <StatusBadge label="Re-inspection" tone="info" />
              )}
              <span className="text-xs text-ink-400">
                {inspection.inspector.fullName} ·{" "}
                {formatDateTime(inspection.createdAt)}
              </span>
            </div>

            {inspection.rejectionReason && (
              <p className="mt-2 text-sm text-ink-900">
                {rejectionReasonLabel(inspection.rejectionReason)}
              </p>
            )}
            {inspection.notes && (
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                {inspection.notes}
              </p>
            )}

            {failedItems.length > 0 && (
              <p className="mt-2 text-xs text-danger">
                Did not pass: {failedItems.join(", ")}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The courier's own record — status, tracking number and scan history. */
export function ShipmentPanel({ parcel }: { parcel: OperationsSubOrder }) {
  const { shipment } = parcel;

  if (!shipment) {
    return (
      <p className="text-xs text-ink-400">
        No courier assigned yet. Dispatching this parcel creates the shipment
        and its tracking number.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink-900">{shipment.courierName}</p>
          <p className="mt-0.5 font-mono text-xs text-ink-500">
            {shipment.trackingNumber}
          </p>
        </div>
        <StatusBadge
          label={
            SHIPMENT_STATUS_LABEL[shipment.status as ShipmentStatus] ??
            shipment.status
          }
          tone={
            shipment.status === "DELIVERED"
              ? "success"
              : shipment.status === "DELIVERY_FAILED"
                ? "danger"
                : "info"
          }
        />
      </div>

      {shipment.failureReason && (
        <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
          Last attempt failed — {shipment.failureReason}. The order stays out
          for delivery; the courier will re-attempt.
        </p>
      )}

      {shipment.events.length > 0 && (
        <ol className="space-y-3 border-t border-ivory-300 pt-4">
          {shipment.events.map((event) => (
            <li key={event.id} className="text-xs">
              <p className="text-ink-900">
                {SHIPMENT_STATUS_LABEL[event.status as ShipmentStatus] ??
                  event.status}
                {event.location && (
                  <span className="text-ink-500"> · {event.location}</span>
                )}
              </p>
              {event.note && (
                <p className="mt-0.5 text-ink-500">{event.note}</p>
              )}
              <p className="mt-0.5 text-[0.6875rem] uppercase tracking-[0.1em] text-ink-400">
                {formatDateTime(event.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
