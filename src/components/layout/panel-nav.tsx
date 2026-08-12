"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Sidebar navigation for a signed-in panel.
 *
 * Built once here rather than per panel: the customer, seller, admin and
 * operations areas differ in their items, not in how a sidebar behaves. It is a
 * client component only because the active item depends on the current path.
 *
 * On small screens it becomes a horizontally scrolling strip rather than a
 * drawer — a panel's navigation is the thing a customer needs most on a phone,
 * and burying it behind a menu button to save 40 pixels is a poor trade.
 */

export type PanelNavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Rendered as a count beside the label. Zero and undefined both hide it. */
  badge?: number;
};

export function PanelNav({
  items,
  ariaLabel = "Account sections",
}: {
  items: PanelNavItem[];
  ariaLabel?: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={ariaLabel}
      className="border-b border-ivory-400 lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r"
    >
      <ul className="flex gap-1 overflow-x-auto px-3 py-2 lg:flex-col lg:gap-0.5 lg:px-3 lg:py-6">
        {items.map((item) => {
          /**
           * An item owns its sub-routes — /account/orders/SAAW-… keeps "Orders"
           * highlighted — *unless* another item in the same list is nested under
           * it, which is exactly the case for a panel root like /account,
           * /seller or /admin. Deriving that from the list rather than naming
           * the roots keeps every panel correct without a hard-coded exception
           * per panel; the previous version only excused "/account", so the
           * seller and admin dashboards stayed lit on every page.
           */
          const ownsSubRoutes = !items.some(
            (other) =>
              other.href !== item.href &&
              other.href.startsWith(`${item.href}/`),
          );

          const isActive =
            pathname === item.href ||
            (ownsSubRoutes && pathname.startsWith(`${item.href}/`));

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 whitespace-nowrap px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-600"
                    : "text-ink-500 hover:bg-ivory-200 hover:text-ink-900",
                )}
              >
                <span aria-hidden="true" className="shrink-0">
                  {item.icon}
                </span>
                {item.label}
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={cn(
                      "ml-auto hidden min-w-5 rounded-full px-1.5 py-0.5 text-center text-[0.625rem] font-medium leading-none lg:inline-block",
                      isActive
                        ? "bg-brand-600 text-ivory-50"
                        : "bg-ivory-300 text-ink-500",
                    )}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
