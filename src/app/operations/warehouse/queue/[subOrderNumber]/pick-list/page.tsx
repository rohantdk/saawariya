import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperations } from "@/lib/operations/context";
import { getOperationsSubOrder } from "@/lib/operations/queues";
import { PrintButton } from "@/components/seller/print-button";
import { SUB_ORDER_STATUS_LABEL } from "@/lib/commerce/order-status";
import { PAYMENT_METHOD_LABEL, ROLES, type PaymentMethod } from "@/lib/constants";
import { availableQty } from "@/lib/inventory-status";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({
  params,
}: PageProps<"/operations/warehouse/queue/[subOrderNumber]/pick-list">): Promise<Metadata> {
  const { subOrderNumber } = await params;
  return { title: `Pick list ${subOrderNumber}` };
}

/**
 * The sheet an operator carries to the shelves — SRS §95, §96.
 *
 * A print stylesheet rather than a generated PDF, for the same reason the
 * seller's packing slip is one: the browser already renders, paginates and
 * prints this document, and a PDF library would mean a second layout to keep
 * looking like the first.
 *
 * It carries no money. A pick list is a physical instruction — what to fetch,
 * how many, where it goes — and line prices on it are a distraction at best and
 * a way to leak a seller's margins onto a warehouse floor at worst. The value
 * of the parcel appears only where it has to: the COD amount to collect.
 */
export default async function PickListPage({
  params,
}: PageProps<"/operations/warehouse/queue/[subOrderNumber]/pick-list">) {
  await requireOperations(ROLES.WAREHOUSE);
  const { subOrderNumber } = await params;

  const parcel = await getOperationsSubOrder(subOrderNumber);
  if (!parcel) notFound();

  const units = parcel.items.reduce((sum, item) => sum + item.quantity, 0);
  const payment = parcel.order.payments[0];
  const isCod = payment?.method === "COD" && payment.status === "PENDING";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/operations/warehouse/queue/${parcel.subOrderNumber}`}
          className="text-xs font-medium uppercase tracking-[0.14em] text-ink-400 transition-colors hover:text-brand-600"
        >
          ← Back to the parcel
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-md border border-ivory-400 bg-ivory-50 p-8 print:border-0 print:p-0">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-6 border-b border-ivory-400 pb-6">
          <div>
            <p className="font-display text-2xl text-ink-900">Saawariya</p>
            <p className="mt-1 text-xs text-ink-400">Warehouse pick list</p>
          </div>
          <div className="text-right text-xs">
            <p className="text-ink-900">{parcel.subOrderNumber}</p>
            <p className="mt-1 text-ink-400">
              Order {parcel.order.orderNumber}
            </p>
            <p className="text-ink-400">
              {SUB_ORDER_STATUS_LABEL[parcel.status] ?? parcel.status}
            </p>
          </div>
        </header>

        <div className="mb-8 grid gap-6 sm:grid-cols-2">
          <section>
            <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
              Supplied by
            </p>
            <p className="text-sm text-ink-900">
              {parcel.seller.businessName}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              Confirmed{" "}
              {formatDate(parcel.confirmedAt ?? parcel.createdAt)}
            </p>
          </section>

          <section>
            <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
              Deliver to
            </p>
            <p className="text-sm text-ink-900">
              {parcel.order.shipShippingName}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {parcel.order.shipLine1}
            </p>
            {parcel.order.shipLine2 && (
              <p className="text-xs text-ink-500">{parcel.order.shipLine2}</p>
            )}
            <p className="text-xs text-ink-500">
              {parcel.order.shipCity}, {parcel.order.shipState}{" "}
              {parcel.order.shipPinCode}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {parcel.order.shipMobile}
            </p>
          </section>
        </div>

        {isCod && (
          <p className="mb-6 rounded-md border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
            Cash on delivery —{" "}
            {PAYMENT_METHOD_LABEL[payment.method as PaymentMethod]} of{" "}
            {new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              maximumFractionDigits: 0,
            }).format(payment.amount / 100)}{" "}
            is due on this order. Do not release the parcel without it.
          </p>
        )}

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ivory-400 text-left">
              <th className="pb-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-400">
                SKU
              </th>
              <th className="pb-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-400">
                Item
              </th>
              <th className="pb-2 text-right text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-400">
                Pick
              </th>
              <th className="pb-2 text-right text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-400">
                On shelf
              </th>
              <th className="pb-2 text-right text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-400">
                Picked ✓
              </th>
            </tr>
          </thead>
          <tbody>
            {parcel.items.map((item) => {
              const variant = item.variantId
                ? item.product.variants.find((v) => v.id === item.variantId)
                : null;
              const inventory = item.product.inventory;

              return (
                <tr key={item.id} className="border-b border-ivory-300">
                  <td className="py-3 align-top font-mono text-xs text-ink-500">
                    {item.productSku}
                  </td>
                  <td className="py-3 align-top">
                    <p className="text-ink-900">{item.productName}</p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {[
                        variant && `${variant.name}: ${variant.value}`,
                        item.product.fabric,
                        item.product.color,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </td>
                  <td className="py-3 text-right align-top font-display text-lg text-ink-900">
                    {item.quantity}
                  </td>
                  <td className="py-3 text-right align-top text-xs text-ink-500">
                    {inventory
                      ? `${inventory.stockQty} (${availableQty(inventory)} free)`
                      : "—"}
                  </td>
                  <td className="py-3 text-right align-top">
                    {/* An actual box to tick in ink — this sheet is used away
                        from a screen, which is the whole point of printing it. */}
                    <span
                      aria-hidden="true"
                      className="inline-block h-5 w-5 rounded-md border border-ink-900/40"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="mt-6 text-sm text-ink-900">
          {parcel.items.length} line{parcel.items.length === 1 ? "" : "s"} ·{" "}
          {units} unit{units === 1 ? "" : "s"} in total
        </p>

        <div className="mt-10 grid gap-6 border-t border-ivory-400 pt-6 sm:grid-cols-2">
          <div>
            <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-400">
              Picked by
            </p>
            <div className="mt-8 border-b border-ink-900/30" />
          </div>
          <div>
            <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-400">
              Checked by
            </p>
            <div className="mt-8 border-b border-ink-900/30" />
          </div>
        </div>
      </article>
    </div>
  );
}
