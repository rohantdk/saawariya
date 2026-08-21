/**
 * When a parcel is expected to leave the warehouse — SRS §45.
 *
 * Two bugs are fixed here, and they compound.
 *
 * The first is arithmetic. The confirmation page added `dispatchDays` as
 * calendar days while the copy beside it said "working days", so an order
 * placed on a Friday quoted a Sunday.
 *
 * The second is the one that matters. The estimate was computed once for the
 * whole order from a flat two-day window, which is right for a piece picked off
 * a shelf and badly wrong for one that has not been woven yet: an order holding
 * an eight-week commission was still promising dispatch on Tuesday. Because
 * parcels ship per seller and a commission can sit alongside stocked goods in
 * the same parcel, the estimate has to be per parcel, and within a parcel it has
 * to follow the slowest line in it — a seller cannot post the box before the
 * cloth is off the loom.
 *
 * Lead times come from OrderItem.loomWeeks, snapshotted at placement, so a
 * seller changing their lead time next month cannot silently rewrite what an
 * existing customer was promised.
 */

/** Adds working days, skipping Saturday and Sunday. */
export function addWorkingDays(from: Date, days: number): Date {
  const date = new Date(from);
  let remaining = Math.max(0, Math.round(days));

  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }

  return date;
}

/**
 * Expected dispatch for one parcel.
 *
 * Weaving runs in calendar weeks — a loom does not stop for the weekend — and
 * the warehouse's picking, QC and packing window is then added in working days
 * on top of it.
 */
export function parcelDispatchDate({
  placedAt,
  dispatchDays,
  loomWeeks,
}: {
  placedAt: Date;
  dispatchDays: number;
  /** Longest lead time among this parcel's lines; null if nothing is commissioned. */
  loomWeeks: number | null;
}): Date {
  const offLoom = new Date(placedAt);
  if (loomWeeks && loomWeeks > 0) {
    offLoom.setDate(offLoom.getDate() + loomWeeks * 7);
  }
  return addWorkingDays(offLoom, dispatchDays);
}

/** The longest lead time in a set of lines, or null if none is commissioned. */
export function longestLoomWeeks(
  items: Array<{ loomWeeks: number | null }>,
): number | null {
  const weeks = items
    .map((item) => item.loomWeeks)
    .filter((value): value is number => typeof value === "number" && value > 0);

  return weeks.length > 0 ? Math.max(...weeks) : null;
}

export type OrderDispatch = {
  /** Per parcel, in the order the parcels were given. */
  parcels: Array<{ date: Date; loomWeeks: number | null }>;
  /** The date the whole order is complete — the slowest parcel. */
  latest: Date;
  /** The first parcel to go, when they differ. */
  earliest: Date;
  /** True when the parcels do not all leave on the same day. */
  isStaggered: boolean;
  /** True when anything in the order is being woven to order. */
  hasCommission: boolean;
};

/**
 * Dispatch expectations for a whole order, parcel by parcel.
 *
 * `latest` is what a headline should quote. Leading with the earliest date and
 * burying the eight-week line below is precisely the misleading summary this
 * exists to remove.
 */
export function orderDispatch({
  placedAt,
  dispatchDays,
  parcels,
}: {
  placedAt: Date;
  dispatchDays: number;
  parcels: Array<{ items: Array<{ loomWeeks: number | null }> }>;
}): OrderDispatch {
  const resolved = parcels.map((parcel) => {
    const loomWeeks = longestLoomWeeks(parcel.items);
    return {
      loomWeeks,
      date: parcelDispatchDate({ placedAt, dispatchDays, loomWeeks }),
    };
  });

  // An order always has at least one sub-order, but a defensive fallback keeps
  // this total rather than letting an empty array produce an Invalid Date.
  const times = resolved.map((parcel) => parcel.date.getTime());
  const latest = new Date(
    times.length ? Math.max(...times) : addWorkingDays(placedAt, dispatchDays).getTime(),
  );
  const earliest = new Date(
    times.length ? Math.min(...times) : latest.getTime(),
  );

  return {
    parcels: resolved,
    latest,
    earliest,
    isStaggered: earliest.getTime() !== latest.getTime(),
    hasCommission: resolved.some((parcel) => parcel.loomWeeks !== null),
  };
}
