import {
  Bell,
  Boxes,
  LayoutDashboard,
  Package,
  ScrollText,
  Store,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { requireSeller } from "@/lib/seller/context";
import { getSellerNavCounts } from "@/lib/seller/dashboard";
import { PanelShell } from "@/components/layout/panel-shell";
import { PanelNav } from "@/components/layout/panel-nav";

/**
 * The seller panel shell — SRS §52-68.
 *
 * Lives in a `(panel)` route group so that `/seller/onboarding` and
 * `/seller/pending` sit *outside* it. Those two are where `requireSeller()`
 * sends an unapproved seller, so wrapping them in a layout that itself calls
 * `requireSeller()` would redirect them to themselves forever.
 *
 * As on the customer side, the pages below still call `requireSeller()`
 * themselves: a layout is not a security boundary in the App Router, because a
 * page is reachable on a client navigation without its layout re-running.
 * `cache()` in the DAL keeps the repeat call to one query per request.
 */
export default async function SellerPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const seller = await requireSeller("/seller");
  const counts = await getSellerNavCounts(seller.sellerId, seller.userId);

  const items = [
    {
      href: "/seller",
      label: "Dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      href: "/seller/orders",
      label: "Orders",
      icon: <Package className="h-4 w-4" />,
      badge: counts.ordersAwaiting,
    },
    {
      href: "/seller/products",
      label: "Products",
      icon: <Boxes className="h-4 w-4" />,
      badge: counts.productsPending,
    },
    {
      href: "/seller/inventory",
      label: "Inventory",
      icon: <ScrollText className="h-4 w-4" />,
      badge: counts.lowStock,
    },
    {
      href: "/seller/settlements",
      label: "Settlements",
      icon: <Wallet className="h-4 w-4" />,
    },
    {
      href: "/seller/reports",
      label: "Reports",
      icon: <TrendingUp className="h-4 w-4" />,
    },
    {
      href: "/seller/notifications",
      label: "Notifications",
      icon: <Bell className="h-4 w-4" />,
      badge: counts.unreadNotifications,
    },
    {
      href: "/seller/profile",
      label: "Business profile",
      icon: <Store className="h-4 w-4" />,
    },
  ];

  return (
    <PanelShell
      user={seller.user}
      sidebar={<PanelNav items={items} ariaLabel="Seller sections" />}
    >
      {children}
    </PanelShell>
  );
}
