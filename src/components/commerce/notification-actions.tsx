"use client";

import { useActionState } from "react";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/account";
import { IDLE_STATE } from "@/lib/validations/commerce";

/**
 * "Mark read" controls.
 *
 * Deliberately explicit rather than marking everything read on page view:
 * a customer who opens this page to check one thing should not lose the marker
 * on the other five. The badge in the sidebar counts the same rows, so it stays
 * in step for free.
 */

export function MarkRead({ notificationId }: { notificationId: string }) {
  const [, action, pending] = useActionState(
    markNotificationRead,
    IDLE_STATE,
  );

  return (
    <form action={action}>
      <input type="hidden" name="notificationId" value={notificationId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-ink-400 transition-colors hover:text-ink-900 disabled:opacity-50"
      >
        Mark as read
      </button>
    </form>
  );
}

export function MarkAllRead() {
  // No form data to send — `useActionState` still gives the pending flag, which
  // is what stops a double click firing two updates.
  const [, action, pending] = useActionState(
    async () => markAllNotificationsRead(),
    IDLE_STATE,
  );

  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-ink-900/15 px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-ink-900 transition-colors hover:border-ink-900/40 hover:bg-ivory-200 disabled:opacity-50"
      >
        {pending ? "Marking…" : "Mark all as read"}
      </button>
    </form>
  );
}
