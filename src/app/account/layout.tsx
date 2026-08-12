import {
  Bell,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Package,
  Settings,
  Star,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/commerce/context";
import { PanelShell } from "@/components/layout/panel-shell";
import { PanelNav } from "@/components/layout/panel-nav";

/**
 * The customer panel shell — SRS §34-51.
 *
 * Authorisation happens here, once, for every page underneath. The pages below
 * still call `requireCustomer()` themselves because they need the customer id
 * and because a layout is not a security boundary in the App Router — a page is
 * reachable without its layout re-running on a client navigation. `cache()` in
 * the DAL means the repeated call costs one query per request, not two.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const customer = await requireCustomer("/account");

  // Badges are counts of things waiting for the customer, not of things that
  // exist: 12 read notifications is not a number anybody needs on a tab.
  const [unreadNotifications, openTickets, wishlistCount] = await Promise.all([
    prisma.notification.count({
      where: { userId: customer.userId, isRead: false },
    }),
    prisma.supportTicket.count({
      where: {
        raisedById: customer.userId,
        status: { notIn: ["RESOLVED", "CLOSED"] },
      },
    }),
    prisma.wishlistItem.count({ where: { customerId: customer.customerId } }),
  ]);

  const items = [
    {
      href: "/account",
      label: "Dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    { href: "/account/orders", label: "Orders", icon: <Package className="h-4 w-4" /> },
    {
      href: "/account/wishlist",
      label: "Wishlist",
      icon: <Heart className="h-4 w-4" />,
      badge: wishlistCount,
    },
    {
      href: "/account/addresses",
      label: "Addresses",
      icon: <MapPin className="h-4 w-4" />,
    },
    { href: "/account/reviews", label: "Reviews", icon: <Star className="h-4 w-4" /> },
    {
      href: "/account/notifications",
      label: "Notifications",
      icon: <Bell className="h-4 w-4" />,
      badge: unreadNotifications,
    },
    {
      href: "/account/support",
      label: "Support",
      icon: <LifeBuoy className="h-4 w-4" />,
      badge: openTickets,
    },
    {
      href: "/account/settings",
      label: "Settings",
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  return (
    <PanelShell user={customer.user} sidebar={<PanelNav items={items} />}>
      {children}
    </PanelShell>
  );
}
