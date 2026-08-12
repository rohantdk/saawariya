import { LayoutDashboard, LifeBuoy, Undo2 } from "lucide-react";
import { requireDesk } from "@/lib/admin/context";
import { supportNavCounts } from "@/lib/support/dashboard";
import { PanelShell } from "@/components/layout/panel-shell";
import { PanelNav } from "@/components/layout/panel-nav";
import { ROLES } from "@/lib/constants";

/**
 * The support desk — SRS §130-140.
 *
 * Outside `/admin/(console)` for the same reason finance and marketing are: that
 * layout calls `requireAdmin()`, which sends a Support user to exactly this page.
 */
export default async function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const desk = await requireDesk(ROLES.SUPPORT, "/admin/support");
  const counts = await supportNavCounts();

  const items = [
    {
      href: "/admin/support",
      label: "Dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      href: "/admin/support/tickets",
      label: "Tickets",
      icon: <LifeBuoy className="h-4 w-4" />,
      badge: counts.tickets,
    },
    {
      href: "/admin/support/returns",
      label: "Returns",
      icon: <Undo2 className="h-4 w-4" />,
      badge: counts.returns,
    },
  ];

  return (
    <PanelShell
      user={desk.user}
      sidebar={<PanelNav items={items} ariaLabel="Support sections" />}
    >
      {children}
    </PanelShell>
  );
}
