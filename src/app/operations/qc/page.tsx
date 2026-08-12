import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Percent, RotateCcw, XCircle } from "lucide-react";
import { requireOperations } from "@/lib/operations/context";
import { rejectionReasonLabel } from "@/lib/operations/checklist";
import { listInspections, qcSummary } from "@/lib/operations/qc";
import { findQueue, listQueue, QC_QUEUES } from "@/lib/operations/queues";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/commerce/status-badge";
import { ROLES } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Quality control" };

/**
 * The QC landing page — SRS §99, §103.
 *
 * The pass rate is `null`, and renders as an em dash, when nothing has been
 * inspected. A 0% pass rate and no inspections at all are very different things
 * and a zero in that tile would report a disaster that has not happened.
 */
export default async function QcDashboardPage() {
  await requireOperations(ROLES.QC, "/operations/qc");

  const [summary, pending, recent] = await Promise.all([
    qcSummary(),
    listQueue(findQueue(QC_QUEUES, "pending")),
    listInspections({}),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">SRS §99-104 — Quality control</p>
        <h1 className="font-display text-3xl">Quality control</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          Every parcel is inspected against the checklist before it is packed. A
          failure does not cancel the order — it goes back to the warehouse to be
          re-picked, and returns here for re-inspection.
        </p>
      </header>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          href="/operations/qc/queue?queue=pending"
          icon={<ClipboardCheck className="h-4 w-4" />}
          value={summary.pending}
          label="Awaiting inspection"
          tone={summary.pending > 0 ? "attention" : "default"}
        />
        <StatTile
          href="/operations/qc/queue?queue=failed"
          icon={<XCircle className="h-4 w-4" />}
          value={summary.failed}
          label="Failed, not sent back"
          tone={summary.failed > 0 ? "attention" : "default"}
        />
        <StatTile
          href="/operations/qc/queue?queue=repicking"
          icon={<RotateCcw className="h-4 w-4" />}
          value={summary.repicking}
          label="Being re-picked"
        />
        <StatTile
          href="/operations/qc/reports"
          icon={<Percent className="h-4 w-4" />}
          value={summary.passRate === null ? "—" : `${summary.passRate}%`}
          label="Pass rate"
          hint={`${summary.inspected} inspection${summary.inspected === 1 ? "" : "s"} on record`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl">Next up</h2>
            <Link
              href="/operations/qc/queue"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              Full queue
            </Link>
          </div>

          {pending.rows.length === 0 ? (
            <p className="border border-ivory-400 bg-ivory-50 p-6 text-sm text-ink-400">
              Nothing waiting. Every picked parcel has been inspected.
            </p>
          ) : (
            <ul className="space-y-2">
              {pending.rows.slice(0, 5).map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/operations/qc/queue/${row.subOrderNumber}`}
                    className="flex flex-wrap items-center justify-between gap-3 border border-ivory-400 bg-ivory-50 p-3 transition-colors hover:border-ink-400"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm text-ink-900">
                        {row.subOrderNumber}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-400">
                        {row.seller.businessName} · picked{" "}
                        {row.pickedAt ? formatDateTime(row.pickedAt) : "—"}
                      </span>
                    </span>
                    {row._count.qcInspections > 0 && (
                      <StatusBadge label="Re-inspection" tone="info" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl">Recent verdicts</h2>
            <Link
              href="/operations/qc/reports"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
            >
              Reports
            </Link>
          </div>

          {recent.inspections.length === 0 ? (
            <p className="border border-ivory-400 bg-ivory-50 p-6 text-sm text-ink-400">
              No inspections recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-ivory-300 border border-ivory-400 bg-ivory-50">
              {recent.inspections.slice(0, 6).map((inspection) => (
                <li key={inspection.id} className="p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/operations/qc/queue/${inspection.subOrder.subOrderNumber}`}
                      className="text-sm text-ink-900 underline-offset-4 hover:underline"
                    >
                      {inspection.subOrder.subOrderNumber}
                    </Link>
                    <StatusBadge
                      label={inspection.result === "PASSED" ? "Passed" : "Failed"}
                      tone={inspection.result === "PASSED" ? "success" : "danger"}
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-400">
                    {rejectionReasonLabel(inspection.rejectionReason) ??
                      inspection.subOrder.seller.businessName}{" "}
                    · {inspection.inspector.fullName} ·{" "}
                    {formatDateTime(inspection.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
