import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { requireCustomer } from "@/lib/commerce/context";
import { MarkAllRead, MarkRead } from "@/components/commerce/notification-actions";

export const metadata: Metadata = { title: "Notifications" };

const CATEGORY_LABEL: Record<string, string> = {
  ORDER: "Order",
  PAYMENT: "Payment",
  SHIPMENT: "Shipment",
  PRODUCT: "Product",
  SETTLEMENT: "Settlement",
  PROMOTION: "Offer",
  SYSTEM: "Account",
  SUPPORT: "Support",
};

/**
 * Notifications — SRS §48.
 *
 * These are written by the actions that cause them (placing an order,
 * cancelling one, changing a password, raising a ticket), never generated for
 * display. That is what makes the list an account history rather than a feed:
 * every row corresponds to something that actually happened.
 */
export default async function NotificationsPage() {
  const customer = await requireCustomer("/account/notifications");

  const notifications = await prisma.notification.findMany({
    where: { userId: customer.userId },
    // Unread first, then newest — the thing needing attention is at the top.
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    take: 60,
    select: {
      id: true,
      title: true,
      body: true,
      category: true,
      linkUrl: true,
      isRead: true,
      createdAt: true,
    },
  });

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">Notifications</h1>
          <p className="mt-2 text-sm text-ink-400">
            {unread === 0
              ? "You are all caught up."
              : `${unread} unread notification${unread === 1 ? "" : "s"}.`}
          </p>
        </div>

        {unread > 0 && <MarkAllRead />}
      </div>

      {notifications.length === 0 ? (
        <div className="mt-8 rounded-md border border-ivory-400 bg-ivory-50 p-10 text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ivory-200 text-ink-400"
          >
            <Bell className="h-5 w-5" />
          </span>
          <p className="text-sm text-ink-400">
            Nothing yet. Updates about your orders and account will appear here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-2">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={
                notification.isRead
                  ? "rounded-md border border-ivory-400 bg-ivory-50 p-4"
                  : "rounded-md border border-brand-600/30 bg-brand-50 p-4"
              }
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[0.625rem] uppercase tracking-[0.12em] text-ink-400">
                  {CATEGORY_LABEL[notification.category] ??
                    notification.category}
                </span>
                {!notification.isRead && (
                  <span
                    aria-label="Unread"
                    className="h-1.5 w-1.5 rounded-full bg-brand-600"
                  />
                )}
                <span className="ml-auto text-xs text-ink-400">
                  {formatDateTime(notification.createdAt)}
                </span>
              </div>

              <p className="mt-1.5 text-sm text-ink-900">
                {notification.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">
                {notification.body}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-4">
                {notification.linkUrl && (
                  <Link
                    href={notification.linkUrl}
                    className="text-xs font-medium uppercase tracking-[0.12em] text-brand-600 hover:underline"
                  >
                    View
                  </Link>
                )}
                {!notification.isRead && (
                  <MarkRead notificationId={notification.id} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
