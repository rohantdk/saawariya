import type { Metadata } from "next";
import Link from "next/link";
import { requireOperations } from "@/lib/operations/context";
import {
  findQueue,
  listQueue,
  QC_QUEUES,
  queueCounts,
} from "@/lib/operations/queues";
import { availableTransitions } from "@/lib/order-state-machine";
import { QueueBoard } from "@/components/operations/queue-board";
import { PipelineActions } from "@/components/operations/pipeline-actions";
import { ButtonLink } from "@/components/ui/button";
import { ROLES, SUB_ORDER_STATUS } from "@/lib/constants";

export const metadata: Metadata = { title: "Inspections" };

/**
 * The inspection queue — SRS §100, §101.
 *
 * A parcel awaiting inspection gets a link, not a verdict button. Passing or
 * failing means running the five-group checklist, and a one-click "pass" in a
 * list would record an inspection that nobody performed — the checklist *is*
 * the evidence, and a verdict without it is an assertion.
 *
 * A failed parcel is different: sending it back to the warehouse is a single
 * decision with nothing to record, so that one is a button on the row.
 */
export default async function QcQueuePage({
  searchParams,
}: PageProps<"/operations/qc/queue">) {
  const ops = await requireOperations(ROLES.QC, "/operations/qc/queue");
  const params = await searchParams;

  const queue = findQueue(
    QC_QUEUES,
    typeof params.queue === "string" ? params.queue : undefined,
  );
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ rows, total, pageCount, page: current }, counts] = await Promise.all([
    listQueue(queue, { q, page }),
    queueCounts(QC_QUEUES),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Inspection</p>
        <h1 className="font-display text-3xl">Inspections</h1>
      </header>

      <QueueBoard
        basePath="/operations/qc/queue"
        queues={QC_QUEUES}
        counts={counts}
        active={queue}
        rows={rows}
        total={total}
        page={current}
        pageCount={pageCount}
        q={q}
        renderActions={
          queue.passive
            ? undefined
            : (row) =>
                row.status === SUB_ORDER_STATUS.QC_PENDING ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <ButtonLink
                      href={`/operations/qc/queue/${row.subOrderNumber}`}
                      size="sm"
                    >
                      Run the checklist
                    </ButtonLink>
                    {row._count.qcInspections > 0 && (
                      <Link
                        href={`/operations/qc/queue/${row.subOrderNumber}`}
                        className="text-xs text-warning underline-offset-4 hover:underline"
                      >
                        Been here {row._count.qcInspections} time
                        {row._count.qcInspections === 1 ? "" : "s"} before
                      </Link>
                    )}
                  </div>
                ) : (
                  <PipelineActions
                    subOrderId={row.id}
                    subOrderNumber={row.subOrderNumber}
                    moves={availableTransitions(row.status, ops.permissions).map(
                      (t) => ({ to: t.to, label: t.label, actor: t.actor }),
                    )}
                    desk="QC"
                    size="sm"
                    emptyLabel="Waiting on another desk."
                  />
                )
        }
      />
    </div>
  );
}
