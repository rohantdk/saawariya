import { LayoutDashboard, Truck, TrendingUp } from "lucide-react";
import { requireOperations } from "@/lib/operations/context";
import { LOGISTICS_QUEUES, queueCounts } from "@/lib/operations/queues";
import { PanelShell } from "@/components/layout/panel-shell";
import { PanelNav } from "@/components/layout/panel-nav";
import { ROLES } from "@/lib/constants";

/** The logistics desk — SRS §107-110. */
export default async function LogisticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ops = await requireOperations(ROLES.LOGISTICS, "/operations/logistics");
  const counts = await queueCounts(LOGISTICS_QUEUES);

  const items = [
    {
      href: "/operations/logistics",
      label: "Dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      href: "/operations/logistics/queue",
      label: "Shipments",
      icon: <Truck className="h-4 w-4" />,
      badge: counts.dispatch,
    },
    {
      href: "/operations/logistics/reports",
      label: "Performance",
      icon: <TrendingUp className="h-4 w-4" />,
    },
  ];

  return (
    <PanelShell
      user={ops.user}
      sidebar={<PanelNav items={items} ariaLabel="Logistics sections" />}
    >
      {children}
    </PanelShell>
  );
}
