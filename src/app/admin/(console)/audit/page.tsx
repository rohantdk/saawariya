import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/context";
import {
  auditActionLabel,
  auditFilterOptions,
  auditModuleOf,
  AUDIT_MODULES,
  listAuditLog,
} from "@/lib/admin/audit";
import { ROLE_LABEL, type RoleCode } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { Select } from "@/components/ui/field";

export const metadata: Metadata = { title: "Audit log" };

/**
 * Who changed what, and when — SRS §89.
 *
 * Every mutation in the admin console writes a row here through
 * `writeAudit()`, inside the same transaction as the change itself, so a
 * rolled-back change cannot leave a row claiming it happened. Customer and
 * seller actions that alter platform state write here too — an order placed, a
 * password changed, a return requested — which is why the trail reaches back
 * before this console existed.
 *
 * The log is append-only and there is no delete control, deliberately: an audit
 * trail an administrator can edit is not an audit trail.
 */
export default async function AdminAuditPage({
  searchParams,
}: PageProps<"/admin/audit">) {
  await requireAdmin("/admin/audit");
  const params = await searchParams;

  // Named `moduleFilter`, not `module` — `module` is a reserved binding in a
  // Next.js module scope and the lint rule that says so is protecting a real
  // bundler footgun.
  const moduleFilter =
    typeof params.module === "string" ? params.module : "all";
  const action = typeof params.action === "string" ? params.action : "";
  const userId = typeof params.userId === "string" ? params.userId : "";
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ entries, total, pageCount, page: current }, options] =
    await Promise.all([
      listAuditLog({ module: moduleFilter, action, userId, q, page }),
      auditFilterOptions(),
    ]);

  const keep = (extra: Record<string, string | number>) => {
    const search = new URLSearchParams();
    if (moduleFilter !== "all") search.set("module", moduleFilter);
    if (action) search.set("action", action);
    if (userId) search.set("userId", userId);
    if (q) search.set("q", q);
    for (const [key, value] of Object.entries(extra)) {
      if (value === "" || value === "all") search.delete(key);
      else search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `/admin/audit?${qs}` : "/admin/audit";
  };

  const TABS = ["all", ...Object.keys(AUDIT_MODULES)];

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">SRS §89 — Audit log</p>
        <h1 className="font-display text-3xl">Audit log</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          Append-only. Each row is written in the same transaction as the change
          it records, so nothing here describes something that was rolled back —
          and there is no way to remove one from this screen.
        </p>
      </header>

      <nav aria-label="Filter by module" className="mb-5">
        <ul className="flex flex-wrap gap-1 border-b border-ivory-400">
          {TABS.map((tab) => {
            const isActive = moduleFilter === tab;
            return (
              <li key={tab}>
                <Link
                  href={keep({ module: tab, page: 1 })}
                  aria-current={isActive ? "page" : undefined}
                  className={`-mb-px inline-block border-b-2 px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {tab === "all" ? "Everything" : tab}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form
        action="/admin/audit"
        className="mb-6 flex flex-wrap items-center gap-2"
      >
        {moduleFilter !== "all" && (
          <input type="hidden" name="module" value={moduleFilter} />
        )}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search the record"
          aria-label="Search the audit log"
          className="min-w-0 flex-1 border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none sm:max-w-xs"
        />
        <Select
          name="action"
          defaultValue={action}
          aria-label="Filter by action"
          className="w-full py-2.5 sm:w-56"
        >
          <option value="">Every action</option>
          {options.actions.map((item) => (
            <option key={item.code} value={item.code}>
              {item.label} ({item.count})
            </option>
          ))}
        </Select>
        <Select
          name="userId"
          defaultValue={userId}
          aria-label="Filter by who acted"
          className="w-full py-2.5 sm:w-52"
        >
          <option value="">Anyone</option>
          {options.actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.fullName}
            </option>
          ))}
        </Select>
        <button
          type="submit"
          className="h-11 shrink-0 border border-ink-900/15 px-5 text-xs font-medium uppercase tracking-[0.12em] text-ink-900 transition-colors hover:bg-ivory-200"
        >
          Filter
        </button>
      </form>

      {entries.length === 0 ? (
        <div className="border border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-ink-400">
            Nothing recorded for these filters.
          </p>
        </div>
      ) : (
        <ol className="border border-ivory-400 bg-ivory-50">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="border-b border-ivory-300 px-5 py-4 last:border-b-0"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-xs text-ink-400">
                  {formatDateTime(entry.createdAt)}
                </span>
                <span className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-brand-600">
                  {auditActionLabel(entry.action)}
                </span>
                <span className="text-xs text-ink-400">
                  {auditModuleOf(entry.action)}
                </span>
              </div>

              <p className="mt-1.5 text-sm leading-relaxed text-ink-900">
                {entry.summary}
              </p>

              <p className="mt-1 text-xs text-ink-400">
                {entry.user ? (
                  <>
                    {entry.user.fullName} ·{" "}
                    {ROLE_LABEL[entry.user.roleCode as RoleCode] ??
                      entry.user.roleCode}
                  </>
                ) : (
                  // SetNull on delete: the actor's account is gone, the record
                  // of what they did is not.
                  "Account since removed"
                )}
                {" · "}
                {entry.entityType} {entry.entityId.slice(0, 8)}
              </p>
            </li>
          ))}
        </ol>
      )}

      {pageCount > 1 && (
        <nav
          aria-label="Pagination"
          className="mt-8 flex items-center justify-between gap-4"
        >
          {current > 1 ? (
            <Link
              href={keep({ page: current - 1 })}
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <p className="text-xs text-ink-400">
            Page {current} of {pageCount} · {total} entr
            {total === 1 ? "y" : "ies"}
          </p>
          {current < pageCount ? (
            <Link
              href={keep({ page: current + 1 })}
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
