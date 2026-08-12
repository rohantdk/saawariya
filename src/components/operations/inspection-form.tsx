"use client";

import { useActionState, useState } from "react";
import { recordQcVerdict } from "@/app/actions/operations-qc";
import { checklistFieldName } from "@/lib/operations/checklist";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { QC_CHECKLIST, QC_REJECTION_REASONS } from "@/lib/constants";

/**
 * The five-group inspection checklist — SRS §102, §104.
 *
 * Every import here is from a module with no server dependency:
 * `QC_CHECKLIST` and `QC_REJECTION_REASONS` from `src/lib/constants.ts`, and
 * `checklistFieldName` from `src/lib/operations/checklist.ts`. That split
 * exists *because of this file* — the helper originally sat in
 * `src/lib/operations/qc.ts`, which imports `prisma`, and importing it here
 * pulled `better-sqlite3` into the browser bundle. `tsc` and `eslint` passed;
 * `next build` failed with a `node:module` chunking error. Phase 6 hit the same
 * class with the admin settings form, which is why the rule is written down in
 * `checklist.ts` rather than left in one file's memory.
 *
 * The two verdicts are separate submits rather than a radio pair, because they
 * ask for different things: a pass needs nothing but the ticks, a failure needs
 * a reason before it will go. Both post the same checklist.
 *
 * **The boxes start unticked.** Pre-ticking them would make a pass a single
 * click and the stored checklist a record of sixteen checks nobody performed —
 * and that record is the whole reason the row exists. "Tick everything" is
 * offered because sixteen clicks per parcel is a real cost, but it is an act
 * the inspector takes rather than a default they failed to notice.
 */
export function InspectionForm({
  subOrderId,
  isReinspection,
}: {
  subOrderId: string;
  isReinspection: boolean;
}) {
  const [state, action, pending] = useActionState(recordQcVerdict, IDLE_STATE);
  const [failing, setFailing] = useState(false);
  /**
   * Remounts every checkbox so `defaultChecked` is re-read. Uncontrolled inputs
   * keep the form working with JavaScript disabled, which a controlled
   * sixteen-item checklist would not; bumping a key is how you reset them.
   */
  const [tickAllNonce, setTickAllNonce] = useState(0);
  const [allTicked, setAllTicked] = useState(false);

  const groups = Object.entries(QC_CHECKLIST);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="subOrderId" value={subOrderId} />

      {state.status !== "idle" && state.message && (
        <FormMessage tone={state.status === "error" ? "error" : "success"}>
          {state.message}
        </FormMessage>
      )}

      {isReinspection && (
        <FormMessage tone="info">
          This parcel has been inspected before. Read the history below before
          deciding — it will be recorded as a re-inspection either way.
        </FormMessage>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setAllTicked((previous) => !previous);
            setTickAllNonce((n) => n + 1);
          }}
          disabled={pending}
        >
          {allTicked ? "Clear every check" : "Tick everything"}
        </Button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {groups.map(([key, group]) => (
          <fieldset key={key} className="border border-ivory-400 p-4">
            <legend className="px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
              {group.label}
            </legend>
            <ul className="space-y-2.5">
              {group.items.map((item) => {
                const id = `qc-${key}-${item.replace(/\s+/g, "-").toLowerCase()}`;
                return (
                  <li key={item}>
                    <label
                      htmlFor={id}
                      className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-900"
                    >
                      <input
                        key={tickAllNonce}
                        id={id}
                        type="checkbox"
                        name={checklistFieldName(key, item)}
                        defaultChecked={allTicked}
                        className="h-4 w-4 shrink-0 accent-[var(--color-brand-600)]"
                      />
                      {item}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>

      <Field
        label="Notes"
        htmlFor="qc-notes"
        errors={state.errors?.notes}
        hint="Optional on a pass. On a failure this is what tells the warehouse what to fix."
      >
        <Input
          id="qc-notes"
          name="notes"
          maxLength={500}
          placeholder="e.g. Zari border frayed along 20cm of the pallu"
          invalid={Boolean(state.errors?.notes)}
        />
      </Field>

      {failing && (
        <Field
          label="What was wrong"
          htmlFor="qc-reason"
          errors={state.errors?.rejectionReason}
        >
          <Select
            id="qc-reason"
            name="rejectionReason"
            required
            defaultValue=""
            invalid={Boolean(state.errors?.rejectionReason)}
          >
            <option value="" disabled>
              Choose a reason
            </option>
            {Object.entries(QC_REJECTION_REASONS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="flex flex-wrap gap-3 border-t border-ivory-300 pt-5">
        {!failing && (
          <>
            {/* A submit button's own value is what posts, so the two verdicts
                are one form with two buttons rather than a hidden field
                rewritten on click — the trap the seller stock form hit in
                Phase 5. */}
            <Button
              type="submit"
              name="result"
              value="PASSED"
              disabled={pending}
            >
              {pending ? "Recording…" : "Pass inspection"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-danger"
              onClick={() => setFailing(true)}
              disabled={pending}
            >
              Fail inspection
            </Button>
          </>
        )}

        {failing && (
          <>
            <Button
              type="submit"
              name="result"
              value="FAILED"
              variant="danger"
              disabled={pending}
            >
              {pending ? "Recording…" : "Record the failure"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setFailing(false)}
              disabled={pending}
            >
              Back
            </Button>
          </>
        )}
      </div>

      <p className="text-xs leading-relaxed text-ink-400">
        Every box must be ticked to pass. A failure sends the parcel back to the
        warehouse to be re-picked; it does not cancel the customer&rsquo;s
        order.
      </p>
    </form>
  );
}
