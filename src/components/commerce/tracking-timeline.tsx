import { Check } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { TRACKING_STAGES, trackingStageIndex } from "@/lib/commerce/order-status";

/**
 * The five-stage progress rail a customer sees for one parcel.
 *
 * It renders the collapsed stage, not the raw pipeline status — the mapping
 * lives in src/lib/commerce/order-status.ts and is deliberately lossy. A parcel
 * that failed inspection and went back to the warehouse still reads "Being
 * prepared" here, which is true, while the full detail stays in the event log
 * below for anyone who needs it.
 *
 * Cancelled and returned parcels get no rail at all: a progress bar implies
 * something is still moving.
 */
export function TrackingTimeline({
  status,
  timestamps,
}: {
  status: string;
  timestamps: {
    placedAt: Date;
    confirmedAt: Date | null;
    dispatchedAt: Date | null;
    deliveredAt: Date | null;
  };
}) {
  const currentIndex = trackingStageIndex(status);
  if (currentIndex < 0) return null;

  const stageTimes: (Date | null)[] = [
    timestamps.placedAt,
    timestamps.confirmedAt,
    timestamps.dispatchedAt,
    null,
    timestamps.deliveredAt,
  ];

  return (
    <ol className="flex flex-col gap-0 sm:flex-row sm:gap-0">
      {TRACKING_STAGES.map((stage, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        const reached = isDone || isCurrent;
        const at = stageTimes[index];

        return (
          <li
            key={stage.key}
            className="relative flex gap-3 pb-6 sm:flex-1 sm:flex-col sm:gap-2 sm:pb-0"
            aria-current={isCurrent ? "step" : undefined}
          >
            {/* Connector. Horizontal on wide screens, vertical on narrow. */}
            {index < TRACKING_STAGES.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[0.4375rem] top-5 h-full w-px sm:left-auto sm:top-[0.4375rem] sm:h-px sm:w-full sm:translate-x-4",
                  isDone ? "bg-brand-600" : "bg-ivory-400",
                )}
              />
            )}

            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full",
                isDone
                  ? "bg-brand-600 text-cream"
                  : isCurrent
                    ? "bg-brand-600 ring-4 ring-brand-50"
                    : "rounded-md border border-ivory-400 bg-ivory-50",
              )}
            >
              {isDone && <Check className="h-2 w-2" strokeWidth={4} />}
            </span>

            <span className="min-w-0">
              <span
                className={cn(
                  "block text-xs",
                  reached ? "text-ink-900" : "text-ink-400",
                  isCurrent && "font-medium",
                )}
              >
                {stage.label}
              </span>
              {at && reached && (
                <span className="mt-0.5 block text-[0.6875rem] text-ink-400">
                  {formatDateTime(at)}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
