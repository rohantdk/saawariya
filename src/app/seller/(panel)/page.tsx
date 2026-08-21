import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  IndianRupee,
  Package,
  Truck,
  Wallet,
} from "lucide-react";
import { requireSeller } from "@/lib/seller/context";
import { getSellerDashboard } from "@/lib/seller/dashboard";
import { SUB_ORDER_STATUS_LABEL, subOrderTone } from "@/lib/commerce/order-status";
import { PRODUCT_STATUS } from "@/lib/constants";
import { formatDate, formatPaise } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { StatTile } from "@/components/ui/stat-tile";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Seller dashboard" };

/**
 * Seller dashboard — SRS §56.
 *
 * The page answers one question first: *is anything waiting for me?* Orders to
 * confirm, products held in review and stock about to run out are the three
 * things a seller loses money by not seeing, so they lead — and when none of
 * them is outstanding the section says so rather than vanishing, which would
 * leave the seller unsure whether it had loaded.
 */
export default async function SellerDashboardPage() {
  const seller = await requireSeller("/seller");
  const data = await getSellerDashboard(seller.sellerId, seller.userId);

  const { counts, products, revenue } = data;
  const firstName = seller.user.fullName.split(" ")[0];
  const nothingWaiting =
    counts.ordersAwaiting === 0 &&
    counts.productsPending === 0 &&
    counts.lowStock === 0;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <p className="eyebrow mb-2">Seller dashboard</p>
        <h1 className="font-display text-3xl sm:text-4xl">Hello, {firstName}</h1>
        <p className="mt-2 text-sm text-ink-400">
          {products.total === 0
            ? "List your first product to start selling on Saawariya."
            : `You have ${products.byStatus[PRODUCT_STATUS.APPROVED]} product${
                products.byStatus[PRODUCT_STATUS.APPROVED] === 1 ? "" : "s"
              } live on the marketplace.`}
        </p>
      </header>

      {/* ---- Waiting on you ---- */}
      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl">Waiting on you</h2>

        {nothingWaiting ? (
          <p className="rounded-md border border-ivory-400 bg-ivory-50 px-5 py-4 text-sm text-ink-400">
            Nothing needs your attention right now.
          </p>
        ) : (
          <ul className="space-y-2">
            {counts.ordersAwaiting > 0 && (
              <Prompt
                href="/seller/orders?status=awaiting"
                text={`${counts.ordersAwaiting} new order${counts.ordersAwaiting === 1 ? "" : "s"} to confirm`}
                tone="attention"
              />
            )}
            {counts.lowStock > 0 && (
              <Prompt
                href="/seller/inventory"
                text={`${counts.lowStock} product${counts.lowStock === 1 ? "" : "s"} low or out of stock`}
              />
            )}
            {counts.productsPending > 0 && (
              <Prompt
                href="/seller/products?status=PENDING"
                text={`${counts.productsPending} product${counts.productsPending === 1 ? "" : "s"} awaiting approval`}
              />
            )}
          </ul>
        )}
      </section>

      {/* ---- Figures ---- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          href="/seller/orders?status=awaiting"
          icon={<Package className="h-4 w-4" />}
          value={counts.ordersAwaiting}
          label="Orders to confirm"
          tone={counts.ordersAwaiting > 0 ? "attention" : "default"}
        />
        <StatTile
          href="/seller/orders?status=fulfilment"
          icon={<Truck className="h-4 w-4" />}
          value={revenue.inFulfilment}
          label="In fulfilment"
          hint="With the Saawariya warehouse"
        />
        <StatTile
          href="/seller/reports"
          icon={<IndianRupee className="h-4 w-4" />}
          value={formatPaise(revenue.deliveredGross)}
          label="Delivered sales"
          hint={`${revenue.deliveredCount} order${revenue.deliveredCount === 1 ? "" : "s"}`}
        />
        <StatTile
          href="/seller/settlements"
          icon={<Wallet className="h-4 w-4" />}
          value={formatPaise(revenue.settlementPending)}
          label="Awaiting payout"
          hint={`${formatPaise(revenue.settlementReleased)} released to date`}
        />
      </div>

      {/* ---- Recent orders ---- */}
      <section className="mt-10">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl">Recent orders</h2>
          {data.recentOrders.length > 0 && (
            <Link
              href="/seller/orders"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-400 transition-colors hover:text-brand-600"
            >
              All orders
            </Link>
          )}
        </div>

        {data.recentOrders.length === 0 ? (
          <div className="rounded-md border border-ivory-400 bg-ivory-50 p-8 text-center">
            <p className="text-sm text-ink-400">
              No orders yet. They will appear here as customers buy your
              products.
            </p>
            <ButtonLink href="/seller/products" className="mt-5">
              Manage products
            </ButtonLink>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.recentOrders.map((sub) => (
              <li key={sub.id}>
                <Link
                  href={`/seller/orders/${sub.subOrderNumber}`}
                  className="flex flex-wrap items-center gap-4 rounded-md border border-ivory-400 bg-ivory-50 p-4 transition-colors hover:border-ink-400"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-900">{sub.subOrderNumber}</p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {formatDate(sub.createdAt)} ·{" "}
                      {sub.items.length} item
                      {sub.items.length === 1 ? "" : "s"} ·{" "}
                      {formatPaise(sub.subtotal)}
                    </p>
                  </div>
                  <StatusBadge
                    label={SUB_ORDER_STATUS_LABEL[sub.status] ?? sub.status}
                    tone={subOrderTone(sub.status)}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Catalogue health ---- */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 font-display text-xl">Catalogue</h2>
          <div className="rounded-md border border-ivory-400 bg-ivory-50">
            {(
              [
                [PRODUCT_STATUS.APPROVED, "Live on the marketplace"],
                [PRODUCT_STATUS.PENDING, "Awaiting approval"],
                [PRODUCT_STATUS.DRAFT, "Drafts"],
                [PRODUCT_STATUS.REJECTED, "Rejected"],
                [PRODUCT_STATUS.HIDDEN, "Hidden"],
              ] as const
            ).map(([status, label]) => (
              <div
                key={status}
                className="flex items-center justify-between gap-4 border-b border-ivory-300 px-5 py-3 last:border-b-0"
              >
                <Link
                  href={`/seller/products?status=${status}`}
                  className="text-sm text-ink-500 transition-colors hover:text-brand-600"
                >
                  {label}
                </Link>
                <span className="font-display text-lg text-ink-900">
                  {products.byStatus[status]}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 font-display text-xl">Stock alerts</h2>
          {data.lowStockItems.length === 0 ? (
            <p className="rounded-md border border-ivory-400 bg-ivory-50 px-5 py-4 text-sm text-ink-400">
              Every product is comfortably in stock.
            </p>
          ) : (
            <ul className="rounded-md border border-ivory-400 bg-ivory-50">
              {data.lowStockItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-4 border-b border-ivory-300 px-5 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <Link
                      href="/seller/inventory"
                      className="block truncate text-sm text-ink-900 transition-colors hover:text-brand-600"
                    >
                      {item.product.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {item.product.sku}
                    </p>
                  </div>
                  <span
                    className={
                      item.stockQty === 0
                        ? "shrink-0 text-sm text-danger"
                        : "shrink-0 text-sm text-warning"
                    }
                  >
                    {item.stockQty} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Prompt({
  href,
  text,
  tone = "default",
}: {
  href: string;
  text: string;
  tone?: "default" | "attention";
}) {
  return (
    <li>
      <Link
        href={href}
        className={`flex items-center gap-3 border px-5 py-3.5 text-sm transition-colors ${
          tone === "attention"
            ? "border-brand-600/40 bg-brand-50 text-brand-600 hover:border-brand-600"
            : "border-ivory-400 bg-ivory-50 text-ink-900 hover:border-ink-400"
        }`}
      >
        <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
        {text}
      </Link>
    </li>
  );
}
