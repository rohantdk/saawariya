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
            <Wordmark surface="light" size={34} />
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

/**
 * Temporary landing used by panels whose full build lands in a later phase.
 * Renders live session data, so it still proves authentication and role gating
 * are working rather than being an empty stub.
 */
export function PhasePlaceholder({
  title,
  description,
  srsRef,
  plannedPhase,
  modules,
}: {
  title: string;
  description: string;
  srsRef: string;
  plannedPhase: string;
  modules: string[];
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="eyebrow mb-5">{srsRef}</p>
      <h1 className="mb-3 font-display text-4xl">{title}</h1>
      <p className="mb-8 max-w-xl text-sm leading-relaxed text-ink-400">
        {description}
      </p>

      <div className="border border-ivory-400 bg-ivory-50 p-6">
        <p className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Modules in this panel — {plannedPhase}
        </p>
        <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {modules.map((module) => (
            <li
              key={module}
              className="flex items-center gap-2.5 text-sm text-ink-900"
            >
              <span
                aria-hidden="true"
                className="h-1 w-1 shrink-0 rounded-full bg-gold-400"
              />
              {module}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
