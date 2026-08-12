import type { Metadata } from "next";
import Link from "next/link";
import {
  ClipboardList,
  MessageSquareQuote,
  Package,
  Store,
  Warehouse,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin/context";
import { getAdminDashboard } from "@/lib/admin/dashboard";
import { auditActionLabel } from "@/lib/admin/audit";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  SUB_ORDER_STATUS_LABEL,
  subOrderTone,
} from "@/lib/commerce/order-status";
import { ROLE_LABEL, type OrderStatus, type RoleCode } from "@/lib/constants";
import { formatDate, formatDateTime, formatPaise } from "@/lib/utils";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/commerce/status-badge";

export const metadata: Metadata = { title: "Admin console" };

/**
 * The business overview — SRS §69-72.
 *
 * The top row is **work waiting**, not inventory of what exists: the same
 * counts the sidebar badges render, from the same function, so the two can
 * never disagree. Money comes second, because a number nobody can act on
 * belongs below the queue that they can.
 *
 * The bottom of the page is honest about what is not built yet. Finance,
 * marketing and support have their own areas (Phases 7 and 8), and pretending
 * otherwise with a dead sidebar item would break the rule this project has held
 * since Phase 1: no dead links, no fake screens.
 */
export default async function AdminDashboardPage() {
  const admin = await requireAdmin("/admin");
  const data = await getAdminDashboard();

  const { counts, revenue, totals, pipeline, recentOrders, recentAudit, topSellers } =
    data;

  const queue = [
    {
      href: "/admin/sellers?status=PENDING",
      icon: <Store className="h-4 w-4" />,
      value: counts.sellersPending,
      label: "Seller applications",
      hint: "awaiting verification",
    },
    {
      href: "/admin/products?status=PENDING",
      icon: <Package className="h-4 w-4" />,
      value: counts.productsPending,
      label: "Products",
      hint: "awaiting approval",
    },
    {
      href: "/admin/reviews",
      icon: <MessageSquareQuote className="h-4 w-4" />,
      value: counts.reviewsPending,
      label: "Reviews",
      hint: "awaiting moderation",
    },
    {
      href: "/admin/orders",
      icon: <ClipboardList className="h-4 w-4" />,
      value: counts.ordersInFlight,
      label: "Orders in flight",
      hint: "not yet delivered or closed",
    },
    {
      href: "/admin/inventory",
      icon: <Warehouse className="h-4 w-4" />,
      value: counts.stockAlerts,
      label: "Stock alerts",
      hint: "low or out of stock",
    },
  ];

  // Only the stages that actually hold something — an eighteen-row list of
  // mostly zeroes hides the two states that matter.
  const activePipeline = Object.entries(pipeline)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <p className="eyebrow mb-2">SRS §69 — Super Admin</p>
        <h1 className="font-display text-3xl">
          Good to see you, {admin.user.fullName.split(" ")[0]}
        </h1>
        <p className="mt-2 text-sm text-ink-400">
          {totals.sellersApproved} verified sellers · {totals.productsLive} live
          products · {totals.customers} customers (
          {totals.wholesaleCustomers} wholesale)
        </p>
      </header>

      {/* ---- Queues ---- */}
      <section className="mb-10">
        <h2 className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Waiting on you
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {queue.map((tile) => (
            <StatTile
              key={tile.href}
              href={tile.href}
              icon={tile.icon}
              value={tile.value}
              label={tile.label}
              hint={tile.hint}
              tone={tile.value > 0 ? "attention" : "default"}
            />
          ))}
        </div>
      </section>

      {/* ---- Money ---- */}
      <section className="mb-10">
        <h2 className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Trade
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            value={formatPaise(revenue.gmvDelivered)}
            label="Delivered merchandise value"
            hint={`${revenue.deliveredCount} sub-orders delivered`}
          />
          <StatTile
            value={formatPaise(revenue.gmvRecent)}
            label="Delivered in 30 days"
            hint={`${revenue.deliveredRecentCount} sub-orders`}
          />
          <StatTile
            value={formatPaise(revenue.commissionEarned)}
            label="Platform commission"
            hint="charged on settled payouts"
          />
          <StatTile
            value={formatPaise(revenue.settlementsPending)}
            label="Owed to sellers"
            hint={`${revenue.settlementsPendingCount} payouts pending`}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-400">
          Merchandise value counts delivered sub-orders, not orders — an order
          spans sellers and can be part-delivered, so summing order totals would
          count goods that were cancelled alongside goods that arrived.
        </p>
      </section>

      {/* `min-w-0` on each cell is load-bearing, not decoration: a grid item
          defaults to `min-width: auto`, so it refuses to shrink below its
          content's min-content width. The widest thing in these lists is a
          `whitespace-nowrap` status badge, which pushed the track to 363px
          inside a 335px container and gave the whole page 8px of horizontal
          scroll at 375px. */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* ---- Recent orders ---- */}
        <section className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl">Recent orders</h2>
            <Link
              href="/admin/orders"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              All {totals.orders} →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="border border-ivory-400 bg-ivory-50 p-6 text-center text-sm text-ink-400">
              No orders yet.
            </div>
          ) : (
            <ul className="border border-ivory-400 bg-ivory-50">
              {recentOrders.map((order) => (
                <li
                  key={order.id}
                  className="border-b border-ivory-300 last:border-b-0"
                >
                  <Link
                    href={`/admin/orders/${order.orderNumber}`}
                    className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-ivory-200"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink-900">
                        {order.orderNumber}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {order.customer.user.fullName} ·{" "}
                        {order._count.subOrders} seller
                        {order._count.subOrders === 1 ? "" : "s"} ·{" "}
                        {formatDate(order.placedAt)}
                      </p>
                    </div>
                    <span className="text-sm text-ink-900">
                      {formatPaise(order.totalAmount)}
                    </span>
                    <StatusBadge
                      label={
                        ORDER_STATUS_LABEL[order.status as OrderStatus] ??
                        order.status
                      }
                      tone={
                        ORDER_STATUS_TONE[order.status as OrderStatus] ??
                        "neutral"
                      }
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- Pipeline ---- */}
        <section className="min-w-0">
          <h2 className="mb-3 font-display text-xl">Fulfilment pipeline</h2>
          {activePipeline.length === 0 ? (
            <div className="border border-ivory-400 bg-ivory-50 p-6 text-center text-sm text-ink-400">
              Nothing in the pipeline.
            </div>
          ) : (
            <ul className="border border-ivory-400 bg-ivory-50">
              {activePipeline.map(([status, count]) => (
                <li
                  key={status}
                  className="flex items-center justify-between gap-3 border-b border-ivory-300 px-5 py-3 last:border-b-0"
                >
                  <StatusBadge
                    label={SUB_ORDER_STATUS_LABEL[status] ?? status}
                    tone={subOrderTone(status)}
                  />
                  <span className="text-sm text-ink-900">{count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs leading-relaxed text-ink-400">
            Sub-orders by pipeline stage. The{" "}
            <Link
              href="/operations/warehouse"
              className="underline-offset-4 hover:text-brand-600 hover:underline"
            >
              warehouse
            </Link>
            ,{" "}
            <Link
              href="/operations/qc"
              className="underline-offset-4 hover:text-brand-600 hover:underline"
            >
              QC
            </Link>{" "}
            and{" "}
            <Link
              href="/operations/logistics"
              className="underline-offset-4 hover:text-brand-600 hover:underline"
            >
              logistics
            </Link>{" "}
            desks work these stages; an administrator can override any of them
            from the order screen.
          </p>
        </section>

        {/* ---- Top sellers ---- */}
        <section className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl">Top sellers</h2>
            <Link
              href="/admin/sellers"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              All sellers →
            </Link>
          </div>
          {topSellers.length === 0 ? (
            <div className="border border-ivory-400 bg-ivory-50 p-6 text-center text-sm text-ink-400">
              Nothing delivered yet.
            </div>
          ) : (
            <ul className="border border-ivory-400 bg-ivory-50">
              {topSellers.map((seller) => (
                <li
                  key={seller.sellerId}
                  className="border-b border-ivory-300 last:border-b-0"
                >
                  <Link
                    href={`/admin/sellers/${seller.sellerId}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-ivory-200"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-900">
                      {seller.businessName}
                    </span>
                    <span className="shrink-0 text-xs text-ink-400">
                      {seller.orders} delivered
                    </span>
                    <span className="shrink-0 text-sm text-ink-900">
                      {formatPaise(seller.gross)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- Audit ---- */}
        <section className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl">Recent activity</h2>
            <Link
              href="/admin/audit"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              Audit log →
            </Link>
          </div>
          {recentAudit.length === 0 ? (
            <div className="border border-ivory-400 bg-ivory-50 p-6 text-center text-sm text-ink-400">
              Nothing recorded yet.
            </div>
          ) : (
            <ol className="border border-ivory-400 bg-ivory-50">
              {recentAudit.map((entry) => (
                <li
                  key={entry.id}
                  className="border-b border-ivory-300 px-5 py-3 last:border-b-0"
                >
                  <p className="text-sm leading-relaxed text-ink-900">
                    {entry.summary}
                  </p>
                  <p className="mt-1 text-xs text-ink-400">
                    {auditActionLabel(entry.action)} ·{" "}
                    {entry.user
                      ? `${entry.user.fullName} (${ROLE_LABEL[entry.user.roleCode as RoleCode] ?? entry.user.roleCode})`
                      : "account since removed"}{" "}
                    · {formatDateTime(entry.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* ---- What is not here yet ---- */}
      <section className="mt-10 border border-ivory-400 bg-ivory-50 p-5">
        <p className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Other areas
        </p>
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-ink-400">
          Operations, finance, marketing and support are separate areas with
          their own sign-ins. They are listed here rather than in this sidebar
          because they are not part of the admin console — the three operations
          desks are built and live; the last three arrive in Phase 8, and a
          navigation item that opens a placeholder is exactly the kind of thing
          this build does not ship.
        </p>
        <ul className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ["Warehouse — picking and packing", "Live", "/operations/warehouse"],
            ["Quality control — inspections", "Live", "/operations/qc"],
            ["Logistics — dispatch and delivery", "Live", "/operations/logistics"],
            ["Finance — payouts and refunds", "Phase 8", "/admin/finance"],
            ["Marketing — coupons, banners, CMS", "Phase 8", "/admin/marketing"],
            ["Support — helpdesk and returns", "Phase 8", "/admin/support"],
          ].map(([label, phase, href]) => (
            <li key={href} className="flex items-baseline gap-2">
              <Link
                href={href}
                className="text-ink-900 underline-offset-4 hover:text-brand-600 hover:underline"
              >
                {label}
              </Link>
              <span className="text-xs text-ink-400">{phase}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
