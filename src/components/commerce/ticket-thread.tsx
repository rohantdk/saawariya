"use client";

import { useActionState } from "react";
import Link from "next/link";
import { closeTicket, replyToTicket } from "@/app/actions/support";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { cn, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";

export type ThreadMessage = {
  id: string;
  body: string;
  createdAt: string;
  isMine: boolean;
  authorName: string;
};

/**
 * The conversation, plus the reply box.
 *
 * Only messages the customer is allowed to see reach this component — internal
 * agent notes are excluded by the query, not hidden here. See the note on the
 * page that renders it.
 */
export function TicketThread({
  ticketNumber,
  messages,
  canReply,
  isClosed,
}: {
  ticketNumber: string;
  currentUserId: string;
  messages: ThreadMessage[];
  canReply: boolean;
  isClosed: boolean;
}) {
  const [replyState, replyAction, replyPending] = useActionState(
    replyToTicket,
    IDLE_STATE,
  );
  const [closeState, closeAction, closePending] = useActionState(
    closeTicket,
    IDLE_STATE,
  );

  return (
    <div className="mt-8">
      <ol className="space-y-4">
        {messages.map((message) => (
          <li
            key={message.id}
            className={cn(
              "border p-4",
              message.isMine
                ? "border-ivory-400 bg-ivory-50"
                : "border-brand-600/20 bg-brand-50",
            )}
          >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-xs font-medium text-ink-900">
                {message.isMine ? "You" : message.authorName}
              </span>
              <span className="text-xs text-ink-400">
                {formatDateTime(message.createdAt)}
              </span>
            </div>
            {/* whitespace-pre-line keeps the customer's paragraph breaks
                without letting any markup through. */}
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-500">
              {message.body}
            </p>
          </li>
        ))}
      </ol>

      {canReply ? (
        <div className="mt-6 space-y-4">
          {closeState.status === "success" ? (
            <FormMessage tone="success">
              {closeState.message ?? "Request closed."}
            </FormMessage>
          ) : (
            <>
              <form action={replyAction} className="space-y-3">
                <input
                  type="hidden"
                  name="ticketNumber"
                  value={ticketNumber}
                />

                {replyState.status === "error" && replyState.message && (
                  <FormMessage>{replyState.message}</FormMessage>
                )}

                <label htmlFor="reply-body" className="sr-only">
                  Your message
                </label>
                <textarea
                  id="reply-body"
                  name="body"
                  rows={4}
                  required
                  maxLength={4000}
                  placeholder="Add a message…"
                  className="w-full border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-900 focus:border-brand-600 focus:outline-none"
                />

                <div className="flex flex-wrap items-center gap-4">
                  <Button type="submit" disabled={replyPending}>
                    {replyPending ? "Sending…" : "Send message"}
                  </Button>
                  {replyState.status === "success" && (
                    <span role="status" className="text-sm text-success">
                      Message sent.
                    </span>
                  )}
                </div>
              </form>

              <form action={closeAction}>
                <input
                  type="hidden"
                  name="ticketNumber"
                  value={ticketNumber}
                />
                <button
                  type="submit"
                  disabled={closePending}
                  className="text-xs text-ink-400 underline underline-offset-4 transition-colors hover:text-ink-900 disabled:opacity-50"
                >
                  This is sorted — close the request
                </button>
              </form>
            </>
          )}
        </div>
      ) : (
        isClosed && (
          <p className="mt-6 rounded-md border border-ivory-400 bg-ivory-100 p-4 text-sm text-ink-400">
            This request is closed. If you need anything else,{" "}
            <Link
              href="/account/support/new"
              className="text-brand-600 underline underline-offset-2"
            >
              raise a new one
            </Link>
            .
          </p>
        )
      )}
    </div>
  );
}
