/**
 * How order state is presented to a customer.
 *
 * The fulfilment pipeline has fourteen SubOrder states (warehouse queue,
 * picking, QC pending, QC failed, packing…) because operations needs that
 * resolution. A shopper does not: "QC_PASSED" tells them nothing, and
 * "RETURNED_TO_WAREHOUSE" after a failed inspection is internal laundry. So the
 * pipeline is collapsed into five stages here, once, and every customer-facing
 * screen renders the stage rather than the raw status.
 *
 * Pure module — no imports from the database layer — so the seller and admin
 * panels can reuse the labels without inheriting a query.
 */

import type { OrderStatus } from "@/lib/constants";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

// ---------------------------------------------------------------------------
// ORDER (what the customer placed)
// ---------------------------------------------------------------------------

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  PROCESSING: "Being prepared",
  PARTIALLY_SHIPPED: "Partly dispatched",
  SHIPPED: "Dispatched",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = {
  PENDING: "warning",
  CONFIRMED: "info",
  PROCESSING: "info",
  PARTIALLY_SHIPPED: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
  RETURNED: "warning",
};

/**
 * An order can be cancelled by the customer until someone has physically acted
 * on it. Once any part is dispatched it is a return, not a cancellation, and
 * the two have completely different money and logistics consequences.
 */
export const CUSTOMER_CANCELLABLE: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
];

// ---------------------------------------------------------------------------
// SUB-ORDER (what one seller is fulfilling)
// ---------------------------------------------------------------------------

/** The five stages a customer is shown, in order. */
export const TRACKING_STAGES = [
  { key: "PLACED", label: "Order placed" },
  { key: "PREPARING", label: "Being prepared" },
  { key: "DISPATCHED", label: "Dispatched" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { key: "DELIVERED", label: "Delivered" },
] as const;

export type TrackingStage = (typeof TRACKING_STAGES)[number]["key"];

/**
 * Pipeline status → customer stage.
 *
 * QC_FAILED and RETURNED_TO_WAREHOUSE both map back to "Being prepared": the
 * item genuinely is still being prepared, and a customer told their order
 * "failed inspection" will open a support ticket about a problem the warehouse
 * is already fixing. The full detail stays in OrderEvent for staff.
 */
const STAGE_OF: Record<string, TrackingStage> = {
  PLACED: "PLACED",
  CONFIRMED: "PLACED",
  WAREHOUSE_QUEUE: "PREPARING",
  PICKING: "PREPARING",
  PICKED: "PREPARING",
  QC_PENDING: "PREPARING",
  QC_PASSED: "PREPARING",
  QC_FAILED: "PREPARING",
  RETURNED_TO_WAREHOUSE: "PREPARING",
  PACKING: "PREPARING",
  READY_FOR_DISPATCH: "PREPARING",
  DISPATCHED: "DISPATCHED",
  IN_TRANSIT: "DISPATCHED",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
};

export function trackingStageOf(subOrderStatus: string): TrackingStage | null {
  // Cancelled and returned sub-orders have left the pipeline; a progress bar
  // would imply they are still moving along it.
  return STAGE_OF[subOrderStatus] ?? null;
}

export function trackingStageIndex(subOrderStatus: string): number {
  const stage = trackingStageOf(subOrderStatus);
  if (!stage) return -1;
  return TRACKING_STAGES.findIndex((s) => s.key === stage);
}

export const SUB_ORDER_STATUS_LABEL: Record<string, string> = {
  PLACED: "Placed",
  CONFIRMED: "Confirmed by seller",
  WAREHOUSE_QUEUE: "In warehouse queue",
  PICKING: "Being picked",
  PICKED: "Picked",
  QC_PENDING: "Awaiting quality check",
  QC_PASSED: "Passed quality check",
  QC_FAILED: "Failed quality check",
  RETURNED_TO_WAREHOUSE: "Back in the warehouse",
  PACKING: "Being packed",
  READY_FOR_DISPATCH: "Ready for dispatch",
  DISPATCHED: "Dispatched",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURN_REQUESTED: "Return requested",
  RETURNED: "Returned",
};

/** What the customer is shown for a sub-order, stage-collapsed. */
export function customerSubOrderLabel(status: string): string {
  if (status === "CANCELLED") return "Cancelled";
  if (status === "RETURN_REQUESTED") return "Return requested";
  if (status === "RETURNED") return "Returned";

  const stage = trackingStageOf(status);
  return stage
    ? (TRACKING_STAGES.find((s) => s.key === stage)?.label ?? status)
    : (SUB_ORDER_STATUS_LABEL[status] ?? status);
}

export function subOrderTone(status: string): Tone {
  if (status === "CANCELLED") return "danger";
  if (status === "RETURNED" || status === "RETURN_REQUESTED") return "warning";
  if (status === "DELIVERED") return "success";
  return "info";
}

/** Terminal states — nothing further will happen without a person acting. */
export const SUB_ORDER_TERMINAL = ["DELIVERED", "CANCELLED", "RETURNED"];
