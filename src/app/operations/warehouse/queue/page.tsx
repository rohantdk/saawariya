import type { Metadata } from "next";
import { requireOperations } from "@/lib/operations/context";
import {
  findQueue,
  listQueue,
  queueCounts,
  WAREHOUSE_QUEUES,
} from "@/lib/operations/queues";
import { availableTransitions } from "@/lib/order-state-machine";
import { QueueBoard } from "@/components/operations/queue-board";
import { PipelineActions } from "@/components/operations/pipeline-actions";
import { ROLES } from "@/lib/constants";

export const metadata: Metadata = { title: "Warehouse queues" };

/**
 * The warehouse's work, in four trays — SRS §94-97.
 *
 * Each row carries its own controls, built from `availableTransitions()` against
 * this viewer's permissions, so the common case — pull in, start picking, mark
 * picked, send to QC — never needs the detail page. Opening a parcel is for when
 * something is wrong with it.
 */
export default async function WarehouseQueuePage({
  searchParams,
}: PageProps<"/operations/warehouse/queue">) {
  const ops = await requireOperations(
    ROLES.WAREHOUSE,
    "/operations/warehouse/queue",
  );
  const params = await searchParams;

  const queue = findQueue(
    WAREHOUSE_QUEUES,
    typeof params.queue === "string" ? params.queue : undefined,
  );
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ rows, total, pageCount, page: current }, counts] = await Promise.all([
    listQueue(queue, { q, page }),
    queueCounts(WAREHOUSE_QUEUES),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">SRS §94-97 — Picking &amp; packing</p>
        <h1 className="font-display text-3xl">Queues</h1>
      </header>

      <QueueBoard
        basePath="/operations/warehouse/queue"
        queues={WAREHOUSE_QUEUES}
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
            : (row) => (
                <PipelineActions
                  subOrderId={row.id}
                  subOrderNumber={row.subOrderNumber}
                  moves={availableTransitions(row.status, ops.permissions).map(
                    (t) => ({ to: t.to, label: t.label, actor: t.actor }),
                  )}
                  desk="WAREHOUSE"
                  size="sm"
                  emptyLabel="Waiting on another desk."
                />
              )
        }
      />
    </div>
  );
}
