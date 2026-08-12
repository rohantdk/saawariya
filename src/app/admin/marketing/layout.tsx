import {
  FileText,
  LayoutDashboard,
  Megaphone,
  Send,
  Ticket,
  Images,
} from "lucide-react";
import { requireDesk } from "@/lib/admin/context";
import { marketingNavCounts } from "@/lib/marketing/dashboard";
import { PanelShell } from "@/components/layout/panel-shell";
import { PanelNav } from "@/components/layout/panel-nav";
import { ROLES } from "@/lib/constants";

/**
 * The marketing desk — SRS §123-129.
 *
 * Outside `/admin/(console)` for the same reason the finance desk is: that
 * layout calls `requireAdmin()`, which redirects a Marketing user to exactly
 * this page. Inside the group that is an infinite redirect.
 *
 * The badges count what is **wrong**, not what exists — a campaign whose window
 * opened while it was still a draft, a content page that is unpublished. A badge
 * showing "6 campaigns" would be decoration; one showing "1 overdue" is a
 * reason to click.
 */
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const desk = await requireDesk(ROLES.MARKETING, "/admin/marketing");
  const counts = await marketingNavCounts();

  const items = [
    {
      href: "/admin/marketing",
      label: "Dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      href: "/admin/marketing/coupons",
      label: "Coupons",
      icon: <Ticket className="h-4 w-4" />,
    },
    {
      href: "/admin/marketing/banners",
      label: "Banners",
      icon: <Images className="h-4 w-4" />,
    },
    {
      href: "/admin/marketing/campaigns",
      label: "Campaigns",
      icon: <Megaphone className="h-4 w-4" />,
      badge: counts.campaigns,
    },
    {
      href: "/admin/marketing/content",
      label: "Content pages",
      icon: <FileText className="h-4 w-4" />,
      badge: counts.content,
    },
    {
      href: "/admin/marketing/audience",
      label: "Audience",
      icon: <Send className="h-4 w-4" />,
    },
  ];

  return (
    <PanelShell
      user={desk.user}
      sidebar={<PanelNav items={items} ariaLabel="Marketing sections" />}
    >
      {children}
    </PanelShell>
  );
}
