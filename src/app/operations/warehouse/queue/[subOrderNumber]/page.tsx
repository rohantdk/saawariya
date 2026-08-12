import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperations } from "@/lib/operations/context";
import {
  getOperationsSubOrder,
  WAREHOUSE_HELD,
} from "@/lib/operations/queues";
import { availableTransitions } from "@/lib/order-state-machine";
import {
  DeliveryAddress,
  Panel,
  ParcelHeader,
  ParcelItems,
  ParcelTimeline,
  QcHistory,
} from "@/components/operations/parcel";
import { PipelineActions } from "@/components/operations/pipeline-actions";
import { DiscrepancyForm } from "@/components/operations/discrepancy-form";
import { ButtonLink } from "@/components/ui/button";
import { ROLES } from "@/lib/constants";

export async function generateMetadata({
  params,
}: PageProps<"/operations/warehouse/queue/[subOrderNumber]">): Promise<Metadata> {
  const { subOrderNumber } = await params;
  return { title: `Pick ${subOrderNumber}` };
}

/**
 * One parcel, from the warehouse's point of view — SRS §95-98.
 *
 * The stock figure sits beside every line because that is the question this
 * screen exists to answer before someone walks to the shelf: a line for ten
 * against twelve in stock with ten already reserved is a shortage waiting to
 * happen, and finding that out here is much cheaper than finding it out there.
 *
 * Past QC inspections are shown even though this is not the QC desk. A parcel
 * that has come back for re-picking arrives with no explanation otherwise, and
 * "re-pick it" without "because the colour was wrong" produces the same failure
 * a second time.
 */
export default async function WarehouseParcelPage({
  params,
}: PageProps<"/operations/warehouse/queue/[subOrderNumber]">) {
  const ops = await requireOperations(ROLES.WAREHOUSE);
  const { subOrderNumber } = await params;

  const parcel = await getOperationsSubOrder(subOrderNumber);
  if (!parcel) notFound();

  const moves = availableTransitions(parcel.status, ops.permissions).map((t) => ({
    to: t.to,
    label: t.label,
    actor: t.actor,
  }));

  const held = WAREHOUSE_HELD.includes(parcel.status);

  return (
    <div className="mx-auto max-w-4xl">
      <ParcelHeader
        parcel={parcel}
        backHref="/operations/warehouse/queue"
        backLabel="Back to the queues"
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ButtonLink
          href={`/operations/warehouse/queue/${parcel.subOrderNumber}/pick-list`}
          variant="secondary"
          size="sm"
        >
          Printable pick list
        </ButtonLink>
        <Link
          href={`/operations/qc/queue/${parcel.subOrderNumber}`}
          className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
        >
          Open at the QC desk
        </Link>
      </div>

      <div className="mb-6">
        <Panel title="What happens next">
          <PipelineActions
            subOrderId={parcel.id}
            subOrderNumber={parcel.subOrderNumber}
            moves={moves}
            desk="WAREHOUSE"
            emptyLabel="Nothing for the warehouse to do — this parcel is with another desk or already closed."
          />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Panel
            title="Pick list"
            hint="Stock shown is what the shelf holds now, including what other live orders are already holding."
          >
            <ParcelItems parcel={parcel} showStock />
          </Panel>

          {held && (
            <Panel title="Shortage or damage">
              <DiscrepancyForm
                subOrderId={parcel.id}
                lines={parcel.items.map((item) => ({
                  id: item.id,
                  productName: item.productName,
                  productSku: item.productSku,
                  quantity: item.quantity,
                }))}
              />
            </Panel>
          )}

          <Panel title="Quality control history">
            <QcHistory parcel={parcel} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            title="Deliver to"
            hint="The warehouse ships this parcel, so it carries the full address. The seller sees only the city and PIN."
          >
            <DeliveryAddress parcel={parcel} />
          </Panel>

          <Panel title="Supplied by">
            <p className="text-sm text-ink-900">
              {parcel.seller.businessName}
            </p>
            <p className="mt-0.5 text-xs text-ink-400">
              {parcel.seller.ownerName}
              {parcel.seller.city && ` · ${parcel.seller.city}`}
              {parcel.seller.state && `, ${parcel.seller.state}`}
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
