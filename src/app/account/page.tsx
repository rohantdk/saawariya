import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Heart,
  IndianRupee,
  Package,
  ShoppingBag,
  Star,
} from "lucide-react";
import { formatDate, formatPaise } from "@/lib/utils";
import { requireCustomer } from "@/lib/commerce/context";
import {
  getAccountSummary,
  getReviewableItems,
  listCustomerOrders,
} from "@/lib/commerce/orders";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
} from "@/lib/commerce/order-status";
import { CUSTOMER_TYPE, type OrderStatus } from "@/lib/constants";
import { StatusBadge } from "@/components/commerce/status-badge";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "My account" };

/**
 * Customer dashboard — SRS §35.
 *
 * Every number on this page is counted from real rows. Where a count is zero
 * the tile says so and offers the action that would change it, rather than
 * being hidden — a customer with no orders should still be able to see that
 * "Orders" is a thing their account has.
 */
export default async function AccountPage() {
  const customer = await requireCustomer("/account");

  const [summary, recent, reviewable] = await Promise.all([
    getAccountSummary(customer.customerId, customer.userId),
    listCustomerOrders(customer.customerId, { page: 1 }),
    getReviewableItems(customer.customerId, customer.userId),
  ]);

  const firstName = customer.user.fullName.split(" ")[0];
  const isWholesale = customer.customerType === CUSTOMER_TYPE.WHOLESALE;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <p className="eyebrow mb-2">
          {isWholesale ? "Wholesale account" : "Retail account"}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl">Hello, {firstName}</h1>
        <p className="mt-2 text-sm text-ink-400">
          {summary.totalOrders === 0
            ? "Your orders, wishlist and support requests will appear here."
            : `You have placed ${summary.totalOrders} order${summary.totalOrders === 1 ? "" : "s"} with us.`}
        </p>
      </header>

      {/* ---- Tiles ---- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          href="/account/orders"
          icon={<Package className="h-4 w-4" />}
          value={summary.activeOrders}
          label="Orders in progress"
        />
        <Tile
          href="/cart"
          icon={<ShoppingBag className="h-4 w-4" />}
          value={summary.cartCount}
          label="Items in your bag"
        />
        <Tile
          href="/account/wishlist"
          icon={<Heart className="h-4 w-4" />}
          value={summary.wishlistCount}
          label="Saved items"
        />
        <Tile
          href="/account/orders"
          icon={<IndianRupee className="h-4 w-4" />}
          value={formatPaise(summary.lifetimeSpendPaise)}
          label="Ordered to date"
        />
      </div>

      {/* ---- Waiting on you ---- */}
      {(summary.unreadNotifications > 0 ||
        summary.openTickets > 0 ||
        reviewable.length > 0) && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-xl">Waiting on you</h2>
          <ul className="space-y-2">
            {summary.unreadNotifications > 0 && (
              <Prompt
                href="/account/notifications"
                text={`${summary.unreadNotifications} unread notification${summary.unreadNotifications === 1 ? "" : "s"}`}
              />
            )}
            {summary.openTickets > 0 && (
              <Prompt
                href="/account/support"
                text={`${summary.openTickets} open support request${summary.openTickets === 1 ? "" : "s"}`}
              />
            )}
            {reviewable.length > 0 && (
              <Prompt
                href="/account/reviews"
                text={`Review ${reviewable.length} item${reviewable.length === 1 ? "" : "s"} you have received`}
              />
            )}
          </ul>
        </section>
      )}

      {/* ---- Recent orders ---- */}
      <section className="mt-10">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl">Recent orders</h2>
          {recent.orders.length > 0 && (
            <Link
              href="/account/orders"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-400 transition-colors hover:text-brand-600"
            >
              All orders
            </Link>
          )}
        </div>

        {recent.orders.length === 0 ? (
          <div className="border border-ivory-400 bg-ivory-50 p-8 text-center">
            <p className="text-sm text-ink-400">
              You have not placed an order yet.
            </p>
            <ButtonLink href="/shop" className="mt-5">
              Browse the shop
            </ButtonLink>
          </div>
        ) : (
          <ul className="space-y-3">
            {recent.orders.slice(0, 3).map((order) => {
              const images = order.subOrders
                .flatMap((sub) => sub.items)
                .filter((item) => item.imageUrl)
                .slice(0, 4);

              return (
                <li key={order.id}>
                  <Link
                    href={`/account/orders/${order.orderNumber}`}
                    className="flex flex-wrap items-center gap-4 border border-ivory-400 bg-ivory-50 p-4 transition-colors hover:border-ink-400"
                  >
                    <div className="flex -space-x-2">
                      {images.map((item) => (
                        <span
                          key={item.id}
                          className="relative aspect-square w-10 overflow-hidden border-2 border-ivory-50 bg-ivory-200"
                        >
                          <Image
                            src={item.imageUrl as string}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        </span>
                      ))}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink-900">{order.orderNumber}</p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {formatDate(order.placedAt)} ·{" "}
                        {formatPaise(order.totalAmount)}
                        {order.subOrders.length > 1 &&
                          ` · ${order.subOrders.length} parcels`}
                      </p>
                    </div>

                    <StatusBadge
                      label={ORDER_STATUS_LABEL[order.status as OrderStatus]}
                      tone={ORDER_STATUS_TONE[order.status as OrderStatus]}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- Wholesale nudge ---- */}
      {!isWholesale && (
        <section className="mt-10 border border-ivory-400 bg-ivory-50 p-6">
          <h2 className="font-display text-xl">Buying for a business?</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-400">
            Register your GSTIN to unlock trade pricing, bulk minimums and
            GST-compliant invoices across the catalogue.
          </p>
          <ButtonLink
            href="/account/settings"
            variant="secondary"
            size="sm"
            className="mt-4"
          >
            Add a GSTIN
          </ButtonLink>
        </section>
      )}
    </div>
  );
}

function Tile({
  href,
  icon,
  value,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  value: number | string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="border border-ivory-400 bg-ivory-50 p-4 transition-colors hover:border-ink-400"
    >
      <span aria-hidden="true" className="text-ink-400">
        {icon}
      </span>
      <p className="mt-3 font-display text-2xl text-ink-900">{value}</p>
      <p className="mt-0.5 text-xs text-ink-400">{label}</p>
    </Link>
  );
}

function Prompt({ href, text }: { href: string; text: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-2 border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-900 transition-colors hover:border-ink-400 hover:text-brand-600"
      >
        <Star aria-hidden="true" className="h-3.5 w-3.5 text-gold-500" />
        {text}
        <ArrowRight aria-hidden="true" className="ml-auto h-3.5 w-3.5" />
      </Link>
    </li>
  );
}
