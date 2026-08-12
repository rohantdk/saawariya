import { LayoutDashboard, PackageSearch, ScrollText, Warehouse } from "lucide-react";
import { requireOperations } from "@/lib/operations/context";
import { queueCounts, WAREHOUSE_QUEUES } from "@/lib/operations/queues";
import { warehouseInventoryCounts } from "@/lib/operations/warehouse";
import { PanelShell } from "@/components/layout/panel-shell";
import { PanelNav } from "@/components/layout/panel-nav";
import { ROLES } from "@/lib/constants";

/**
 * The warehouse desk — SRS §93-98.
 *
 * No route group is needed here, unlike `/seller/(panel)` and
 * `/admin/(console)`: those two exist because their gate redirects to a page
 * *inside* the area it guards. `requireOperations` sends a wrong-role user to
 * their own desk, which is a different area, so there is no cycle to break.
 *
 * The pages below still call `requireOperations()` themselves. A layout is not
 * a security boundary in the App Router — a page renders on a client navigation
 * without its layout re-running — and `cache()` in the DAL keeps the repeat call
 * to one query per request.
 */
export default async function WarehouseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ops = await requireOperations(ROLES.WAREHOUSE, "/operations/warehouse");
  const [counts, stock] = await Promise.all([
    queueCounts(WAREHOUSE_QUEUES),
    warehouseInventoryCounts(),
  ]);

  const items = [
    {
      href: "/operations/warehouse",
      label: "Dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      href: "/operations/warehouse/queue",
      label: "Queues",
      icon: <PackageSearch className="h-4 w-4" />,
      // The inbound tray is the number worth carrying in the sidebar: it is
      // work that has arrived and that nobody here has looked at yet.
      badge: counts.inbound,
    },
    {
      href: "/operations/warehouse/inventory",
      label: "Stock",
      icon: <Warehouse className="h-4 w-4" />,
      badge: stock.alerts,
    },
    {
      href: "/operations/warehouse/movements",
      label: "Stock ledger",
      icon: <ScrollText className="h-4 w-4" />,
    },
  ];

  return (
    <PanelShell
      user={ops.user}
      sidebar={<PanelNav items={items} ariaLabel="Warehouse sections" />}
    >
      {children}
    </PanelShell>
  );
}
