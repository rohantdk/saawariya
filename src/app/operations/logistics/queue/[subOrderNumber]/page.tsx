import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOperations } from "@/lib/operations/context";
import { getOperationsSubOrder } from "@/lib/operations/queues";
import { availableTransitions } from "@/lib/order-state-machine";
import {
  DeliveryAddress,
  Panel,
  ParcelHeader,
  ParcelItems,
  ParcelTimeline,
  ShipmentPanel,
} from "@/components/operations/parcel";
import { DispatchForm } from "@/components/operations/dispatch-form";
import { TrackingForm } from "@/components/operations/tracking-form";
import { ROLES, SUB_ORDER_STATUS } from "@/lib/constants";

export async function generateMetadata({
  params,
}: PageProps<"/operations/logistics/queue/[subOrderNumber]">): Promise<Metadata> {
  const { subOrderNumber } = await params;
  return { title: `Shipment ${subOrderNumber}` };
}

/**
 * One parcel, from the courier desk — SRS §108-110.
 *
 * Two histories side by side, and keeping them distinct is the point: the
 * order timeline is what the platform did, the shipment history is what the
 * carrier reported. A failed attempt appears on both and moves neither.
 */
export default async function LogisticsParcelPage({
  params,
}: PageProps<"/operations/logistics/queue/[subOrderNumber]">) {
  const ops = await requireOperations(ROLES.LOGISTICS);
  const { subOrderNumber } = await params;

  const parcel = await getOperationsSubOrder(subOrderNumber);
  if (!parcel) notFound();

  const readyToDispatch = parcel.status === SUB_ORDER_STATUS.READY_FOR_DISPATCH;
  const moves = availableTransitions(parcel.status, ops.permissions).map((t) => ({
    to: t.to,
    label: t.label,
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <ParcelHeader
        parcel={parcel}
        backHref="/operations/logistics/queue"
        backLabel="Back to shipments"
      />

      <div className="mb-6">
        <Panel
          title={readyToDispatch ? "Dispatch" : "What happens next"}
          hint={
            readyToDispatch
              ? "Assigning a courier creates the shipment, generates the tracking number and takes the goods off the warehouse shelf."
              : undefined
          }
        >
          {readyToDispatch ? (
            <DispatchForm subOrderId={parcel.id} />
          ) : (
            <TrackingForm
              subOrderId={parcel.id}
              subOrderNumber={parcel.subOrderNumber}
              moves={moves}
              canFail={
                parcel.status === SUB_ORDER_STATUS.OUT_FOR_DELIVERY ||
                parcel.status === SUB_ORDER_STATUS.IN_TRANSIT
              }
            />
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Panel title="Shipment">
            <ShipmentPanel parcel={parcel} />
          </Panel>

          <Panel title="Contents">
            <ParcelItems parcel={parcel} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Deliver to">
            <DeliveryAddress parcel={parcel} />
          </Panel>

          <Panel title="Order timeline">
            <ParcelTimeline parcel={parcel} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
