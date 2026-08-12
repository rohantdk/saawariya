"use client";

import { useActionState } from "react";
import { toggleBanner, toggleCoupon } from "@/app/actions/marketing";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";

/**
 * Switch one coupon or banner on or off from the list.
 *
 * The single most common marketing action is "turn that off", and making it a
 * round trip through an edit form is how a promotion stays live for another ten
 * minutes. The target state rides on the button's own `value` rather than in
 * client state — the Phase 5 lesson about a form serialising before a
 * re-render lands.
 */
export function ToggleButton({
  kind,
  id,
  isActive,
}: {
  kind: "coupon" | "banner";
  id: string;
  isActive: boolean;
}) {
  const [state, action, pending] = useActionState(
    kind === "coupon" ? toggleCoupon : toggleBanner,
    IDLE_STATE,
  );

  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        name="isActive"
        value={isActive ? "false" : "true"}
        size="sm"
        variant="secondary"
        disabled={pending}
      >
        {pending ? "Working…" : isActive ? "Switch off" : "Switch on"}
      </Button>
      {state.message && (
        <span
          role={state.status === "error" ? "alert" : "status"}
          className={`text-xs ${
            state.status === "error" ? "text-danger" : "text-success"
          }`}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
