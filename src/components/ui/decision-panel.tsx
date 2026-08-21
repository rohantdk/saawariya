"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/field";
import { IDLE_STATE, type ActionState } from "@/lib/validations/commerce";

/**
 * "Choose what happens to this thing, and say why."
 *
 * One component for the settlement queue, the refund queue and the returns desk,
 * because all three are the same control: a list of legal moves, a note that
 * some of them require, and a result message. Three near-identical panels is how
 * "Reject" ends up asking for a reason on one screen and not the other.
 *
 * **Every move is a submit button carrying its target in `value`**, and the note
 * is a plain textarea in the same form. That is deliberate and it is the Phase 5
 * lesson written down: the first version of the seller stock form set a hidden
 * input inside the click handler that was already submitting, and the form
 * serialises before the re-render lands, so the pre-update value is what posts.
 * A submit button's own value is part of the form data, so there is no race to
 * lose. It also means the whole panel works with no client state at all — the
 * only reason this is a Client Component is `useActionState` for the result
 * message.
 *
 * The note box is always visible rather than revealed by the button that needs
 * it, because a control that requires an explanation should say so before you
 * click it, not after the submission is rejected.
 */

export type Decision = {
  to: string;
  label: string;
  requiresNote: boolean;
  primary?: boolean;
};

export function DecisionPanel({
  action,
  idField,
  id,
  moves,
  noteLabel,
  notePlaceholder,
  noteField = "note",
  reference,
  closedMessage,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  idField: string;
  id: string;
  moves: Decision[];
  noteLabel: string;
  notePlaceholder: string;
  /** The form field the note posts as. Tickets call theirs `resolutionNote`. */
  noteField?: string;
  /** Shown only when a payment reference is meaningful — i.e. for payouts. */
  reference?: { label: string; hint: string };
  /** Rendered instead of the controls when nothing can be done. */
  closedMessage: string;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE_STATE);

  if (moves.length === 0) {
    return <p className="text-sm text-ink-400">{closedMessage}</p>;
  }

  const noteRequiredFor = moves
    .filter((move) => move.requiresNote)
    .map((move) => move.label);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name={idField} value={id} />

      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`text-sm leading-relaxed ${
            state.status === "error" ? "text-danger" : "text-success"
          }`}
        >
          {state.message}
        </p>
      )}

      {reference && (
        <div className="space-y-2">
          <Label htmlFor={`reference-${id}`}>{reference.label}</Label>
          <input
            id={`reference-${id}`}
            name="reference"
            maxLength={60}
            placeholder={reference.hint}
            className="rounded-md w-full max-w-sm border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
          />
          <FieldError messages={state.errors?.reference} />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`note-${id}`}>{noteLabel}</Label>
        <textarea
          id={`note-${id}`}
          name={noteField}
          rows={2}
          maxLength={600}
          placeholder={notePlaceholder}
          className="rounded-md w-full border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
        />
        {noteRequiredFor.length > 0 && (
          <p className="text-xs text-ink-400">
            Required for {formatList(noteRequiredFor)}.
          </p>
        )}
        <FieldError messages={state.errors?.[noteField]} />
      </div>

      <div className="flex flex-wrap gap-2">
        {moves.map((move) => (
          <Button
            key={move.to}
            type="submit"
            name="to"
            value={move.to}
            size="sm"
            variant={
              move.primary
                ? "primary"
                : DANGEROUS.has(move.to)
                  ? "danger"
                  : "secondary"
            }
            disabled={pending}
          >
            {pending ? "Working…" : move.label}
          </Button>
        ))}
      </div>
    </form>
  );
}

/** Moves that end badly for somebody, and should not look like the happy path. */
const DANGEROUS = new Set(["REJECTED", "FAILED"]);

function formatList(items: string[]): string {
  if (items.length === 1) return `“${items[0]}”`;
  const quoted = items.map((item) => `“${item}”`);
  return `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`;
}
