"use client";

import { useActionState } from "react";
import {
  assignTicket,
  replyToTicket,
  setTicketPriority,
} from "@/app/actions/support-desk";
import { TICKET_PRIORITY } from "@/lib/constants";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/field";

/**
 * Assignment, priority and the reply box — SRS §134, §136, §137.
 *
 * Three small forms rather than one, because they are three independent
 * decisions and combining them would mean an agent could not change a priority
 * without also posting a reply. The status moves are separate again: they go
 * through `DecisionPanel`, which the finance queues also use.
 */

export function AssignControl({
  ticketId,
  assigneeId,
  agents,
}: {
  ticketId: string;
  assigneeId: string | null;
  agents: { id: string; fullName: string; roleCode: string }[];
}) {
  const [state, action, pending] = useActionState(assignTicket, IDLE_STATE);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <Label htmlFor={`assignee-${ticketId}`}>Assigned to</Label>
      <div className="flex flex-wrap gap-2">
        <select
          id={`assignee-${ticketId}`}
          name="assigneeId"
          /**
           * React 19 resets a form once its action completes, which puts an
           * uncontrolled select back to the option that was server-rendered when
           * the page loaded — so after assigning, this box would say "Nobody"
           * beside a message saying it had been assigned. Keying on the current
           * value remounts it when the server sends a new one, which is the fix
           * that does not require making it controlled (a controlled select has
           * the worse version of this problem — see the broadcast form).
           */
          key={assigneeId ?? "unassigned"}
          defaultValue={assigneeId ?? ""}
          className="min-w-0 flex-1 border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 focus:border-brand-600 focus:outline-none"
        >
          <option value="">Nobody — in the shared queue</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.fullName}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Working…" : "Assign"}
        </Button>
      </div>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`text-xs ${
            state.status === "error" ? "text-danger" : "text-success"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

export function PriorityControl({
  ticketId,
  priority,
}: {
  ticketId: string;
  priority: string;
}) {
  const [state, action, pending] = useActionState(
    setTicketPriority,
    IDLE_STATE,
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <Label htmlFor={`priority-${ticketId}`}>Priority</Label>
      <div className="flex flex-wrap gap-2">
        <select
          id={`priority-${ticketId}`}
          name="priority"
          // Same form-reset problem as the assignee above.
          key={priority}
          defaultValue={priority}
          className="min-w-0 flex-1 border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 focus:border-brand-600 focus:outline-none"
        >
          {Object.values(TICKET_PRIORITY).map((value) => (
            <option key={value} value={value}>
              {value.charAt(0) + value.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Working…" : "Set"}
        </Button>
      </div>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`text-xs ${
            state.status === "error" ? "text-danger" : "text-success"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

/**
 * The reply box, with the internal-note switch on it.
 *
 * One box for both, because an agent writing a reply and an agent writing a
 * private note are the same person at the same moment — two separate boxes is
 * how a note meant to be private gets typed into the public one. The checkbox is
 * the only thing that decides, it is unticked by default, and the label says
 * plainly who can see the result.
 */
export function ReplyBox({
  ticketId,
  closed,
}: {
  ticketId: string;
  closed: boolean;
}) {
  const [state, action, pending] = useActionState(replyToTicket, IDLE_STATE);

  if (closed) {
    return (
      <p className="border border-ivory-400 bg-ivory-50 px-5 py-4 text-sm text-ink-400">
        This ticket is closed. The customer can no longer write to it, so a reply
        would be a message they cannot answer — reopen it from a resolved state,
        or ask them to raise a new request.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />

      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`text-sm ${
            state.status === "error" ? "text-danger" : "text-success"
          }`}
        >
          {state.message}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor={`reply-${ticketId}`}>Reply</Label>
        <textarea
          id={`reply-${ticketId}`}
          name="body"
          rows={4}
          required
          maxLength={4000}
          placeholder="Written to the customer unless you tick the box below."
          className="w-full border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
        />
        <FieldError messages={state.errors?.body} />
      </div>

      <label className="flex items-start gap-3 text-sm text-ink-900">
        <input
          type="checkbox"
          name="isInternalNote"
          className="mt-0.5 h-4 w-4 accent-brand-600"
        />
        <span>
          Internal note — visible to the support desk only
          <span className="block text-xs text-ink-400">
            The customer never sees it, it does not notify them, and it does not
            move the ticket along.
          </span>
        </span>
      </label>

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Sending…" : "Post"}
      </Button>
    </form>
  );
}
