import type { Metadata } from "next";
import Link from "next/link";
import { requireDesk } from "@/lib/admin/context";
import {
  audienceSizes,
  listSubscribers,
  recentBroadcasts,
} from "@/lib/marketing/audience";
import { listCampaigns } from "@/lib/marketing/campaigns";
import {
  CAMPAIGN_AUDIENCE,
  CAMPAIGN_AUDIENCE_LABEL,
  CAMPAIGN_STATUS,
  ROLES,
} from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { BroadcastForm } from "@/components/marketing/broadcast-form";

export const metadata: Metadata = { title: "Audience" };

/**
 * Broadcasts and the newsletter list — SRS §128, §155.
 *
 * The two halves belong on one screen because they are the same question asked
 * twice: who can this platform reach? The newsletter list is people who asked to
 * hear from Saawariya but may have no account; the broadcast audiences are
 * account holders who can be reached in-app today.
 *
 * The distinction matters and the page says it: there is no email gateway in
 * this build, so the newsletter list is collected and shown but **not** mailed
 * from here. An "Email these 40 people" button that did nothing would be exactly
 * the fake control this build does not ship.
 */
export default async function AudiencePage({
  searchParams,
}: PageProps<"/admin/marketing/audience">) {
  await requireDesk(ROLES.MARKETING, "/admin/marketing/audience");
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : "";
  const includeUnsubscribed = params.all === "1";
  const page = Number(params.page) || 1;

  /**
   * The audience is URL state, not client state. React 19 resets a form after
   * its action runs, and a controlled `<select>` comes back showing whatever the
   * server rendered while the React state driving the confirmation count stays
   * put — so the screen said "type 3" while the form would have posted an
   * audience of eleven. Same rule as the storefront filters since Phase 3: the
   * URL is the state, and the number beside the button is server-rendered from
   * exactly what will post.
   */
  const audience =
    typeof params.audience === "string" &&
    params.audience in CAMPAIGN_AUDIENCE_LABEL
      ? params.audience
      : CAMPAIGN_AUDIENCE.ALL;

  const [sizes, campaigns, broadcasts, list] = await Promise.all([
    audienceSizes(),
    listCampaigns("all"),
    recentBroadcasts(),
    listSubscribers({ q, includeUnsubscribed, page }),
  ]);

  // Only campaigns that could plausibly be running are offered, so a broadcast
  // cannot be counted against something that finished last month.
  const attachable = campaigns
    .filter(
      (campaign) =>
        campaign.status === CAMPAIGN_STATUS.ACTIVE ||
        campaign.status === CAMPAIGN_STATUS.SCHEDULED,
    )
    .map((campaign) => ({ id: campaign.id, name: campaign.name }));

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Audience</p>
        <h1 className="font-display text-3xl">Audience</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          Notifications reach people who have an account and are signed in
          somewhere; the newsletter list is people who asked to hear from
          Saawariya. This build has no email gateway, so the list is collected
          and shown here rather than mailed from here.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-4 font-display text-xl">Send a notification</h2>
        <div className="space-y-5 rounded-md border border-ivory-400 bg-ivory-50 p-5">
          {/*
            A separate GET form, not a control inside the one that sends. Forms
            cannot nest, and this is the same "two forms, one panel" arrangement
            checkout uses — it is what keeps the audience in the URL rather than
            in state that a form reset can desync.
          */}
          <form
            action="/admin/marketing/audience"
            className="flex flex-wrap items-end gap-2 border-b border-ivory-300 pb-5"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <label
                htmlFor="audience-picker"
                className="block text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400"
              >
                Who it goes to
              </label>
              <select
                id="audience-picker"
                name="audience"
                defaultValue={audience}
                className="w-full border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-900 focus:border-brand-600 focus:outline-none"
              >
                {[
                  CAMPAIGN_AUDIENCE.ALL,
                  CAMPAIGN_AUDIENCE.NEW_CUSTOMERS,
                  CAMPAIGN_AUDIENCE.RETURNING,
                  CAMPAIGN_AUDIENCE.WHOLESALE,
                ].map((value) => (
                  <option key={value} value={value}>
                    {CAMPAIGN_AUDIENCE_LABEL[value]} ({sizes[value] ?? 0})
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink-400">
                Active customer accounts only — staff accounts are never
                included, and suspended ones cannot sign in to read it.
              </p>
            </div>
            <button
              type="submit"
              className="h-12 shrink-0 border border-ink-900/15 px-5 text-xs font-medium uppercase tracking-[0.12em] text-ink-900 transition-colors hover:bg-ivory-200"
            >
              Choose
            </button>
          </form>

          <BroadcastForm
            audience={audience}
            size={sizes[audience] ?? 0}
            campaigns={attachable}
          />
        </div>
      </section>

      {broadcasts.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 font-display text-xl">Already sent</h2>
          <ul className="rounded-md border border-ivory-400 bg-ivory-50">
            {broadcasts.map((broadcast) => (
              <li
                key={broadcast.title}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-ivory-300 px-4 py-3 last:border-b-0"
              >
                <span className="min-w-0 text-sm text-ink-900">
                  {broadcast.title}
                  <span className="block text-xs text-ink-400">
                    {broadcast.sentAt ? formatDateTime(broadcast.sentAt) : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-ink-400">
                  {broadcast.recipients} recipient
                  {broadcast.recipients === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-xl">Newsletter list</h2>
          <p className="text-xs text-ink-400">
            {list.active} subscribed · {list.unsubscribed} opted out
          </p>
        </div>

        <form
          action="/admin/marketing/audience"
          className="mb-4 flex flex-wrap items-center gap-3"
        >
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search an address"
            aria-label="Search subscribers"
            className="w-full max-w-xs border border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
          />
          <label className="flex items-center gap-2 text-sm text-ink-500">
            <input
              type="checkbox"
              name="all"
              value="1"
              defaultChecked={includeUnsubscribed}
              className="h-4 w-4 accent-brand-600"
            />
            Include people who opted out
          </label>
          <button
            type="submit"
            className="border border-ink-900/15 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.12em] text-ink-900 transition-colors hover:bg-ivory-200"
          >
            Apply
          </button>
        </form>

        {list.subscribers.length === 0 ? (
          <p className="rounded-md border border-ivory-400 bg-ivory-50 px-5 py-4 text-sm text-ink-400">
            Nobody matches this view.
          </p>
        ) : (
          <ul className="rounded-md border border-ivory-400 bg-ivory-50">
            {list.subscribers.map((subscriber) => (
              <li
                key={subscriber.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-ivory-300 px-4 py-3 last:border-b-0"
              >
                <span className="min-w-0 break-all text-sm text-ink-900">
                  {subscriber.email}
                </span>
                <span className="shrink-0 text-xs text-ink-400">
                  {subscriber.unsubscribedAt
                    ? `Opted out ${formatDate(subscriber.unsubscribedAt)}`
                    : `Joined ${formatDate(subscriber.subscribedAt)}`}
                </span>
              </li>
            ))}
          </ul>
        )}

        {list.pageCount > 1 && (
          <nav
            aria-label="Pagination"
            className="mt-6 flex items-center justify-between gap-4"
          >
            {list.page > 1 ? (
              <Link
                href={`/admin/marketing/audience?page=${list.page - 1}${q ? `&q=${q}` : ""}${includeUnsubscribed ? "&all=1" : ""}`}
                className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <p className="text-xs text-ink-400">
              Page {list.page} of {list.pageCount} · {list.total} address
              {list.total === 1 ? "" : "es"}
            </p>
            {list.page < list.pageCount ? (
              <Link
                href={`/admin/marketing/audience?page=${list.page + 1}${q ? `&q=${q}` : ""}${includeUnsubscribed ? "&all=1" : ""}`}
                className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
              >
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
