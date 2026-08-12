import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperations } from "@/lib/operations/context";
import { getOperationsSubOrder } from "@/lib/operations/queues";
import { availableTransitions } from "@/lib/order-state-machine";
import {
  Panel,
  ParcelHeader,
  ParcelItems,
  ParcelTimeline,
  QcHistory,
} from "@/components/operations/parcel";
import { InspectionForm } from "@/components/operations/inspection-form";
import { PipelineActions } from "@/components/operations/pipeline-actions";
import { ROLES, SUB_ORDER_STATUS } from "@/lib/constants";

export async function generateMetadata({
  params,
}: PageProps<"/operations/qc/queue/[subOrderNumber]">): Promise<Metadata> {
  const { subOrderNumber } = await params;
  return { title: `Inspect ${subOrderNumber}` };
}

/**
 * Inspecting one parcel — SRS §101, §102, §104.
 *
 * The checklist only appears when the parcel is actually awaiting inspection.
 * At any other point this page is the parcel's QC record — which is what an
 * operator opening it from the warehouse or from a report wants, and what the
 * customer support desk will want in Phase 8.
 *
 * No delivery address here. QC never ships anything, so the customer's street
 * address has no purpose at this desk; the pick list carries it because the
 * warehouse does.
 */
export default async function QcInspectionPage({
  params,
}: PageProps<"/operations/qc/queue/[subOrderNumber]">) {
  const ops = await requireOperations(ROLES.QC);
  const { subOrderNumber } = await params;

  const parcel = await getOperationsSubOrder(subOrderNumber);
  if (!parcel) notFound();

  const awaitingInspection = parcel.status === SUB_ORDER_STATUS.QC_PENDING;
  const moves = availableTransitions(parcel.status, ops.permissions).map((t) => ({
    to: t.to,
    label: t.label,
    actor: t.actor,
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <ParcelHeader
        parcel={parcel}
        backHref="/operations/qc/queue"
        backLabel="Back to the inspection queue"
      />

      <div className="mb-6">
        <Link
          href={`/operations/warehouse/queue/${parcel.subOrderNumber}`}
          className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
        >
          Open at the warehouse desk
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {awaitingInspection ? (
            <Panel
              title="Inspection"
              hint="Check the goods against every line below, then record a verdict."
            >
              <InspectionForm
                subOrderId={parcel.id}
                isReinspection={parcel.qcInspections.length > 0}
              />
            </Panel>
          ) : (
            <Panel title="What happens next">
              <PipelineActions
                subOrderId={parcel.id}
                subOrderNumber={parcel.subOrderNumber}
                moves={moves}
                desk="QC"
                emptyLabel="Nothing for quality control to do — this parcel is with another desk or already closed."
              />
            </Panel>
          )}

          <Panel title="Inspection history">
            <QcHistory parcel={parcel} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            title="What is in the box"
            hint="Snapshot taken when the order was placed — this is what the customer bought."
          >
            <ParcelItems parcel={parcel} />
          </Panel>

          <Panel title="Supplied by">
            <p className="text-sm text-ink-900">{parcel.seller.businessName}</p>
            <p className="mt-0.5 text-xs text-ink-400">
              {parcel.seller.ownerName}
            </p>
          </Panel>

          <Panel title="Timeline">
            <ParcelTimeline parcel={parcel} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
