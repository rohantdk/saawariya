import { logout } from "@/app/actions/auth";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ROLE_LABEL } from "@/lib/constants";
import type { CurrentUser } from "@/lib/auth/dal";

/**
 * Shared chrome for every signed-in area (customer, seller, admin, operations).
 * Panels differ in their sidebar, not their header, so the header lives here once.
 *
 * `showThemeToggle` is only passed by the customer account layout: dark mode
 * is a shopper-facing preference, not something the seller/admin/operations
 * desks asked for, so those panels never render the control.
 */
export function PanelShell({
  user,
  children,
  sidebar,
  showThemeToggle = false,
}: {
  user: CurrentUser;
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  showThemeToggle?: boolean;
}) {
  const initials = user.fullName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-ivory-400 bg-ivory-50/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-4 px-5 lg:px-8">
          <div className="flex items-center gap-4">
            {/* The wordmark is fixed artwork in two colourways, and the light
                one is maroon on cream — on a dark panel bar it would be
                maroon-on-near-black. Rather than swap colourways (which would
                change the mark itself between themes), it keeps its own pale
                plate in dark mode, the way a printed logo keeps its field. */}
            <span className="inline-flex items-center rounded-md dark:bg-cream dark:px-2.5 dark:py-1.5">
              <Wordmark surface="light" size={34} />
            </span>
            <span className="hidden border-l border-ivory-400 py-1 pl-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-gold-500 sm:inline">
              {ROLE_LABEL[user.role]}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {showThemeToggle && <ThemeToggle surface="light" />}

            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight text-ink-900">
                {user.fullName}
              </p>
              <p className="text-xs leading-tight text-ink-400">{user.email}</p>
            </div>

            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-medium text-cream"
            >
              {initials}
            </span>

            <form action={logout}>
              <Button type="submit" variant="secondary" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Column on phones so the sidebar becomes a strip above the content;
          row from lg, where there is width for a real sidebar. */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {sidebar}
        <main className="min-w-0 flex-1 px-5 py-8 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
