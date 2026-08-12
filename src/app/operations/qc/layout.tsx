import { ClipboardCheck, LayoutDashboard, TrendingUp } from "lucide-react";
import { requireOperations } from "@/lib/operations/context";
import { QC_QUEUES, queueCounts } from "@/lib/operations/queues";
import { PanelShell } from "@/components/layout/panel-shell";
import { PanelNav } from "@/components/layout/panel-nav";
import { ROLES } from "@/lib/constants";

/**
 * The quality control desk — SRS §99-104.
 *
 * QC holds `QC_INSPECT` and nothing else in the pipeline, which is why this
 * panel has no picking or dispatch controls anywhere: the state machine would
 * refuse those moves, so `availableTransitions()` never draws them. The panel
 * did not have to be told.
 */
export default async function QcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ops = await requireOperations(ROLES.QC, "/operations/qc");
  const counts = await queueCounts(QC_QUEUES);

  const items = [
    {
      href: "/operations/qc",
      label: "Dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      href: "/operations/qc/queue",
      label: "Inspections",
      icon: <ClipboardCheck className="h-4 w-4" />,
      badge: counts.pending,
    },
    {
      href: "/operations/qc/reports",
      label: "Reports",
      icon: <TrendingUp className="h-4 w-4" />,
    },
  ];

  return (
    <PanelShell
      user={ops.user}
      sidebar={<PanelNav items={items} ariaLabel="Quality control sections" />}
    >
      {children}
    </PanelShell>
  );
}
