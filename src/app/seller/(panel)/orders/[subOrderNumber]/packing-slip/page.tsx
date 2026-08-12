import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/seller/context";
import { getSellerOrder } from "@/lib/seller/orders";
import { getSellerProfile } from "@/lib/seller/profile";
import { getCommerceSettings } from "@/lib/commerce/settings";
import { formatDate, formatPaise } from "@/lib/utils";
import { PrintButton } from "@/components/seller/print-button";

export async function generateMetadata({
  params,
}: PageProps<"/seller/orders/[subOrderNumber]/packing-slip">): Promise<Metadata> {
  const { subOrderNumber } = await params;
  return { title: `Packing slip ${subOrderNumber}` };
}

/**
 * Packing slip and tax invoice — SRS §62.
 *
 * A print stylesheet rather than generated PDF: the browser already renders
 * this document, already paginates it and already prints to PDF, and adding a
 * PDF library would mean maintaining a second layout that has to be kept
 * looking like the first one.
 *
 * **GST is extracted, not added.** `tax.prices_include_gst` is true and the
 * storefront says "inclusive of all taxes", so the invoice has to show the tax
 * contained in the price. Adding it here would make the invoice disagree with
 * what the customer actually paid — the same trap Phase 4 hit at checkout.
 */
export default async function PackingSlipPage({
  params,
}: PageProps<"/seller/orders/[subOrderNumber]/packing-slip">) {
  const seller = await requireSeller();
  const { subOrderNumber } = await params;

  const [order, profile, settings] = await Promise.all([
    getSellerOrder(seller.sellerId, subOrderNumber),
    getSellerProfile(seller.sellerId),
    getCommerceSettings(),
  ]);

  if (!order || !profile) notFound();

  const goods = order.subtotal - order.discountAmount;
  const taxable = settings.pricesIncludeGst
    ? goods - Math.round((goods * settings.gstPercent) / (100 + settings.gstPercent))
    : goods;
  const tax = goods - taxable;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/seller/orders/${order.subOrderNumber}`}
          className="text-xs font-medium uppercase tracking-[0.14em] text-ink-400 transition-colors hover:text-brand-600"
        >
          ← Back to the order
        </Link>
        <PrintButton />
      </div>

      <article className="border border-ivory-400 bg-ivory-50 p-8 print:border-0 print:p-0">
        {/* ---- Header ---- */}
        <header className="mb-8 flex flex-wrap items-start justify-between gap-6 border-b border-ivory-400 pb-6">
          <div>
            <p className="font-display text-2xl text-ink-900">Saawariya</p>
            <p className="mt-1 text-xs text-ink-400">
              Packing slip &amp; tax invoice
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="text-ink-900">{order.subOrderNumber}</p>
            <p className="mt-1 text-ink-400">
              Order {order.order.orderNumber}
            </p>
            <p className="text-ink-400">
              {formatDate(order.order.placedAt)}
            </p>
          </div>
        </header>

        {/* ---- Parties ---- */}
        <div className="mb-8 grid gap-6 sm:grid-cols-2">
          <section>
            <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
              Sold by
            </p>
            <p className="text-sm text-ink-900">{profile.businessName}</p>
            {profile.addressLine && (
              <p className="mt-1 text-xs text-ink-500">{profile.addressLine}</p>
            )}
            <p className="text-xs text-ink-500">
              {[profile.city, profile.state, profile.pinCode]
                .filter(Boolean)
                .join(", ")}
            </p>
            {profile.gstNumber && (
              <p className="mt-1 text-xs text-ink-500">
                GSTIN: {profile.gstNumber}
              </p>
            )}
          </section>

          <section>
            <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
              Deliver to
            </p>
            <p className="text-sm text-ink-900">
              {order.order.customer.user.fullName}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {order.order.shipCity}, {order.order.shipState}{" "}
              {order.order.shipPinCode}
            </p>
            <p className="mt-2 text-xs text-ink-400">
              Dispatched by the Saawariya warehouse.
            </p>
          </section>
        </div>

        {/* ---- Lines ---- */}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ivory-400 text-left">
              <th className="pb-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-400">
                Item
              </th>
              <th className="pb-2 text-right text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-400">
                Qty
              </th>
              <th className="pb-2 text-right text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-400">
                Unit
              </th>
              <th className="pb-2 text-right text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-400">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-ivory-300">
                <td className="py-3">
                  <p className="text-ink-900">{item.productName}</p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {item.productSku}
                  </p>
                </td>
                <td className="py-3 text-right text-ink-500">
                  {item.quantity}
                </td>
                <td className="py-3 text-right text-ink-500">
                  {formatPaise(item.unitPrice)}
                </td>
                <td className="py-3 text-right text-ink-900">
                  {formatPaise(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ---- Totals ---- */}
        <dl className="mt-6 ml-auto max-w-xs space-y-2 text-sm">
          <div className="flex justify-between gap-4 text-ink-500">
            <dt>Goods</dt>
            <dd>{formatPaise(order.subtotal)}</dd>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between gap-4 text-ink-500">
              <dt>Discount</dt>
              <dd>− {formatPaise(order.discountAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 text-ink-500">
            <dt>Taxable value</dt>
            <dd>{formatPaise(taxable)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-ink-500">
            <dt>GST @ {settings.gstPercent}%</dt>
            <dd>{formatPaise(tax)}</dd>
          </div>
          {order.shippingAmount > 0 && (
            <div className="flex justify-between gap-4 text-ink-500">
              <dt>Shipping</dt>
              <dd>{formatPaise(order.shippingAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t border-ivory-400 pt-2 text-ink-900">
            <dt>Total</dt>
            <dd>{formatPaise(order.totalAmount)}</dd>
          </div>
        </dl>

        <p className="mt-8 border-t border-ivory-400 pt-4 text-xs leading-relaxed text-ink-400">
          {settings.pricesIncludeGst
            ? "All prices are inclusive of GST. The tax shown above is contained in the amount charged, not added to it."
            : "GST has been added to the goods value shown above."}{" "}
          This is a demonstration document generated by the Saawariya
          marketplace; it is not a legal tax invoice.
        </p>
      </article>
    </div>
  );
}
