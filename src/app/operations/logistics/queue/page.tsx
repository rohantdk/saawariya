import type { Metadata } from "next";
import { requireOperations } from "@/lib/operations/context";
import {
  findQueue,
  listQueue,
  LOGISTICS_QUEUES,
  queueCounts,
} from "@/lib/operations/queues";
import { availableTransitions } from "@/lib/order-state-machine";
import { QueueBoard } from "@/components/operations/queue-board";
import { DispatchForm } from "@/components/operations/dispatch-form";
import { TrackingForm } from "@/components/operations/tracking-form";
import { ROLES, SUB_ORDER_STATUS } from "@/lib/constants";

export const metadata: Metadata = { title: "Shipments" };

/**
 * The logistics queues — SRS §108, §109.
 *
 * The dispatch tray gets the courier picker; everything after it gets the
 * tracking controls. They are different components because dispatch creates the
 * shipment and the rest update one, and a single "advance" button could not ask
 * for the courier that dispatch needs.
 */
export default async function LogisticsQueuePage({
  searchParams,
}: PageProps<"/operations/logistics/queue">) {
  const ops = await requireOperations(
    ROLES.LOGISTICS,
    "/operations/logistics/queue",
  );
  const params = await searchParams;

  const queue = findQueue(
    LOGISTICS_QUEUES,
    typeof params.queue === "string" ? params.queue : undefined,
  );
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(params.page) || 1;

  const [{ rows, total, pageCount, page: current }, counts] = await Promise.all([
    listQueue(queue, { q, page }),
    queueCounts(LOGISTICS_QUEUES),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Shipments</p>
        <h1 className="font-display text-3xl">Shipments</h1>
      </header>

      <QueueBoard
        basePath="/operations/logistics/queue"
        queues={LOGISTICS_QUEUES}
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
                row.status === SUB_ORDER_STATUS.READY_FOR_DISPATCH ? (
                  <DispatchForm subOrderId={row.id} compact />
                ) : (
                  <TrackingForm
                    subOrderId={row.id}
                    subOrderNumber={row.subOrderNumber}
                    moves={availableTransitions(row.status, ops.permissions).map(
                      (t) => ({ to: t.to, label: t.label }),
                    )}
                    canFail={
                      row.status === SUB_ORDER_STATUS.OUT_FOR_DELIVERY ||
                      row.status === SUB_ORDER_STATUS.IN_TRANSIT
                    }
                    size="sm"
                  />
                )
        }
      />
    </div>
  );
}
