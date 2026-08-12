import {
  BarChart3,
  Banknote,
  LayoutDashboard,
  Receipt,
  Undo2,
} from "lucide-react";
import { requireDesk } from "@/lib/admin/context";
import { financeNavCounts } from "@/lib/finance/dashboard";
import { PanelShell } from "@/components/layout/panel-shell";
import { PanelNav } from "@/components/layout/panel-nav";
import { ROLES } from "@/lib/constants";

/**
 * The finance desk — SRS §116-122.
 *
 * Sits outside `/admin/(console)` because that layout calls `requireAdmin()`,
 * which sends a Finance user to exactly this page — inside the group that would
 * be an infinite redirect. Same trap and same fix as `/seller/pending` in
 * Phase 5. No route group is needed *here*, for the same reason the operations
 * desks need none: `requireDesk` sends a wrong-role user to a different area, so
 * nothing redirects to itself.
 *
 * The pages below still call `requireDesk()` themselves. A layout is not a
 * security boundary in the App Router — a page renders on a client navigation
 * without its layout re-running — and `cache()` in the DAL keeps the repeat call
 * to one query per request.
 */
export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const desk = await requireDesk(ROLES.FINANCE, "/admin/finance");
  const counts = await financeNavCounts();

  const items = [
    {
      href: "/admin/finance",
      label: "Dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      href: "/admin/finance/settlements",
      label: "Seller payouts",
      icon: <Banknote className="h-4 w-4" />,
      badge: counts.settlements,
    },
    {
      href: "/admin/finance/refunds",
      label: "Refunds",
      icon: <Undo2 className="h-4 w-4" />,
      badge: counts.refunds,
    },
    {
      href: "/admin/finance/payments",
      label: "Transactions",
      icon: <Receipt className="h-4 w-4" />,
    },
    {
      href: "/admin/finance/reports",
      label: "Reports",
      icon: <BarChart3 className="h-4 w-4" />,
    },
  ];

  return (
    <PanelShell
      user={desk.user}
      sidebar={<PanelNav items={items} ariaLabel="Finance sections" />}
    >
      {children}
    </PanelShell>
  );
}
