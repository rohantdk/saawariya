import type { Metadata } from "next";
import Link from "next/link";
import { requireOperations } from "@/lib/operations/context";
import { rejectionReasonLabel } from "@/lib/operations/checklist";
import { listInspections, qcReport } from "@/lib/operations/qc";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/commerce/status-badge";
import { ROLES } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "QC reports" };

const RANGES = [7, 30, 90];

/**
 * QC reporting — SRS §103, §104.
 *
 * Three questions, in the order they get asked: how much is passing, what is
 * failing, and who is inspecting. The rejection-reason breakdown is the one
 * that changes anything — a run of "Wrong Variant" is a picking problem, a run
 * of "Fabric Damage" is a seller problem, and the pass rate alone cannot tell
 * those apart.
 *
 * Bars are plain divs sized by percentage rather than a charting library. At
 * eight categories that is the whole requirement, and it costs the client's
 * bundle nothing.
 */
export default async function QcReportsPage({
  searchParams,
}: PageProps<"/operations/qc/reports">) {
  await requireOperations(ROLES.QC, "/operations/qc/reports");
  const params = await searchParams;

  const requested = Number(params.days);
  const days = RANGES.includes(requested) ? requested : 30;

  const [report, recent] = await Promise.all([
    qcReport(days),
    listInspections({
      result: typeof params.result === "string" ? params.result : undefined,
    }),
  ]);

  const busiestDay = report.daily.reduce(
    (max, day) => Math.max(max, day.passed + day.failed),
    0,
  );
  const topReason = report.reasons[0]?.count ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">QC reporting</p>
        <h1 className="font-display text-3xl">Reports</h1>
      </header>

      <nav aria-label="Report range" className="mb-6">
        <ul className="flex flex-wrap gap-1 border-b border-ivory-400">
          {RANGES.map((range) => {
            const isActive = days === range;
            return (
              <li key={range}>
                <Link
                  href={
                    range === 30
                      ? "/operations/qc/reports"
                      : `/operations/qc/reports?days=${range}`
                  }
                  aria-current={isActive ? "page" : undefined}
                  className={`-mb-px inline-block border-b-2 px-3.5 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-ink-500 hover:text-ink-900"
                  }`}
                >
                  Last {range} days
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile value={report.total} label="Inspections" />
        <StatTile
          value={report.passRate === null ? "—" : `${report.passRate}%`}
          label="Pass rate"
          hint={`${report.passed} passed, ${report.failed} failed`}
        />
        <StatTile
          value={report.failed}
          label="Failures"
          tone={report.failed > 0 ? "attention" : "default"}
        />
        <StatTile
          value={report.reinspections}
          label="Re-inspections"
          hint="Parcels that came back"
        />
      </div>

      {report.total === 0 ? (
        <p className="rounded-md border border-ivory-400 bg-ivory-50 p-10 text-center text-sm text-ink-400">
          No inspections recorded in the last {days} days.
        </p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 font-display text-xl">Why parcels failed</h2>
            {report.reasons.length === 0 ? (
              <p className="rounded-md border border-ivory-400 bg-ivory-50 p-6 text-sm text-ink-400">
                Nothing failed in this period.
              </p>
            ) : (
              <ul className="space-y-3">
                {report.reasons.map((reason) => (
                  <li key={reason.code}>
                    <div className="flex items-baseline justify-between gap-4 text-sm">
                      <span className="min-w-0 text-ink-900">
                        {reason.label}
                      </span>
                      <span className="shrink-0 text-ink-400">
                        {reason.count}
                      </span>
                    </div>
                    <div
                      className="mt-1 h-1.5 bg-ivory-300"
                      role="presentation"
                    >
                      <div
                        className="h-full bg-brand-600"
                        style={{
                          width: `${topReason === 0 ? 0 : (reason.count / topReason) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-4 font-display text-xl">By day</h2>
            <ul className="space-y-2">
              {report.daily.map((day) => {
                const total = day.passed + day.failed;
                return (
                  <li key={day.day} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-ink-400">
                      {formatDate(day.day)}
                    </span>
                    <span
                      className="flex h-3 min-w-0 flex-1 overflow-hidden bg-ivory-300"
                      role="presentation"
                    >
                      <span
                        className="h-full bg-success"
                        style={{
                          width: `${busiestDay === 0 ? 0 : (day.passed / busiestDay) * 100}%`,
                        }}
                      />
                      <span
                        className="h-full bg-danger"
                        style={{
                          width: `${busiestDay === 0 ? 0 : (day.failed / busiestDay) * 100}%`,
                        }}
                      />
                    </span>
                    <span className="w-16 shrink-0 text-right text-xs text-ink-400">
                      {day.passed}/{total}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-ink-400">
              Green is passed, red is failed. Both are counts of inspections,
              not of parcels — a parcel that failed and came back is two.
            </p>
          </section>

          <section className="lg:col-span-2">
            <h2 className="mb-4 font-display text-xl">By inspector</h2>
            <ul className="divide-y divide-ivory-300 rounded-md border border-ivory-400 bg-ivory-50">
              {report.inspectors.map((inspector) => {
                const total = inspector.passed + inspector.failed;
                return (
                  <li
                    key={inspector.name}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
                  >
                    <span className="min-w-0 text-ink-900">
                      {inspector.name}
                    </span>
                    <span className="shrink-0 text-xs text-ink-400">
                      {total} inspection{total === 1 ? "" : "s"} ·{" "}
                      {Math.round((inspector.passed / total) * 100)}% passed
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}

      <section className="mt-10">
        <h2 className="mb-4 font-display text-xl">Inspection log</h2>
        {recent.inspections.length === 0 ? (
          <p className="rounded-md border border-ivory-400 bg-ivory-50 p-6 text-sm text-ink-400">
            Nothing recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-ivory-300 rounded-md border border-ivory-400 bg-ivory-50">
            {recent.inspections.map((inspection) => (
              <li key={inspection.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    href={`/operations/qc/queue/${inspection.subOrder.subOrderNumber}`}
                    className="text-sm text-ink-900 underline-offset-4 hover:underline"
                  >
                    {inspection.subOrder.subOrderNumber}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    {inspection.isReinspection && (
                      <StatusBadge label="Re-inspection" tone="info" />
                    )}
                    <StatusBadge
                      label={inspection.result === "PASSED" ? "Passed" : "Failed"}
                      tone={inspection.result === "PASSED" ? "success" : "danger"}
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs text-ink-400">
                  {inspection.subOrder.seller.businessName} ·{" "}
                  {inspection.inspector.fullName} ·{" "}
                  {formatDateTime(inspection.createdAt)}
                </p>
                {inspection.rejectionReason && (
                  <p className="mt-1 text-xs text-danger">
                    {rejectionReasonLabel(inspection.rejectionReason)}
                    {inspection.notes && ` — ${inspection.notes}`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
