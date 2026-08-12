import {
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  MessageSquareQuote,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  Store,
  Users,
  Warehouse,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin/context";
import { getAdminNavCounts } from "@/lib/admin/dashboard";
import { PanelShell } from "@/components/layout/panel-shell";
import { PanelNav } from "@/components/layout/panel-nav";

/**
 * The Super Admin console shell — SRS §69-90.
 *
 * Lives in a `(console)` route group so `/admin/finance`, `/admin/marketing`
 * and `/admin/support` stay *outside* it. Those three are the landing pages for
 * the Finance, Marketing and Support roles, and this layout calls
 * `requireAdmin()`, which redirects those roles to exactly those pages — inside
 * the group that is an infinite redirect. Same trap, same fix, as
 * `/seller/pending` in Phase 5.
 *
 * The pages below still call `requireAdmin()` themselves. A layout is not a
 * security boundary in the App Router: a page renders on a client navigation
 * without its layout re-running. `cache()` in the DAL keeps the repeat call to
 * one query per request.
 */
export default async function AdminConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin("/admin");
  const counts = await getAdminNavCounts();

  const items = [
    {
      href: "/admin",
      label: "Dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      href: "/admin/sellers",
      label: "Sellers",
      icon: <Store className="h-4 w-4" />,
      badge: counts.sellersPending,
    },
    {
      href: "/admin/products",
      label: "Products",
      icon: <Package className="h-4 w-4" />,
      badge: counts.productsPending,
    },
    {
      href: "/admin/categories",
      label: "Categories",
      icon: <FolderTree className="h-4 w-4" />,
    },
    {
      href: "/admin/customers",
      label: "Customers",
      icon: <Users className="h-4 w-4" />,
    },
    {
      href: "/admin/orders",
      label: "Orders",
      icon: <ClipboardList className="h-4 w-4" />,
      badge: counts.ordersInFlight,
    },
    {
      href: "/admin/inventory",
      label: "Inventory",
      icon: <Warehouse className="h-4 w-4" />,
      badge: counts.stockAlerts,
    },
    {
      href: "/admin/reviews",
      label: "Reviews",
      icon: <MessageSquareQuote className="h-4 w-4" />,
      badge: counts.reviewsPending,
    },
    {
      href: "/admin/settings",
      label: "Settings",
      icon: <Settings className="h-4 w-4" />,
    },
    {
      href: "/admin/roles",
      label: "Roles & access",
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      href: "/admin/audit",
      label: "Audit log",
      icon: <ScrollText className="h-4 w-4" />,
    },
  ];

  return (
    <PanelShell
      user={admin.user}
      sidebar={<PanelNav items={items} ariaLabel="Admin sections" />}
    >
      {children}
    </PanelShell>
  );
}
