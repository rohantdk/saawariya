"use client";

import { useActionState } from "react";
import { sendBroadcast } from "@/app/actions/marketing";
import { CAMPAIGN_AUDIENCE_LABEL } from "@/lib/constants";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";

/**
 * Send a notification to a group of customers — SRS §128.
 *
 * This is the only action in the build that writes to thousands of other
 * people's accounts at once, and there is no unsend. Three things follow, and
 * all three are the point of this component:
 *
 * 1. **The audience size is shown before sending.** "Send to everyone" without
 *    saying how many people that is, is a button nobody can use responsibly.
 * 2. **Confirmation is typed, not ticked.** A checkbox is one careless click;
 *    typing the number is a deliberate act. The server re-derives the count
 *    rather than trusting the form, so a stale page cannot confirm a number that
 *    is no longer the audience.
 * 3. **It says what it actually does.** There is no email or SMS gateway in this
 *    build, so the message becomes an in-app notification — which is real, and
 *    which the recipient genuinely sees. Channel checkboxes that did nothing
 *    would be the fake control this build refuses to ship.
 *
 * ## Why the audience lives in the URL and not in client state
 *
 * React 19 **resets a form once its action completes**, including on a failed
 * submission. An uncontrolled field goes back to its `defaultValue`, which is
 * merely annoying — but a *controlled* `<select>` goes back to the option the
 * server rendered as selected while the React state that drives the displayed
 * count stays where it was. The first version of this form did exactly that: it
 * told the operator "type 3 to confirm" while the select had silently snapped
 * back to "Every customer", so a confirmed send would have gone to eleven people
 * after the screen said three.
 *
 * The server re-deriving the count is what caught it — the mismatch was refused
 * rather than sent — but a form that has to be saved by its own server check is
 * not a form anybody should trust. So the audience is a query parameter and the
 * count is server-rendered, which is the same rule the storefront filters and
 * the applied coupon have followed since Phase 3: **no client state that can
 * disagree with what will actually post.**
 */
export function BroadcastForm({
  audience,
  size,
  campaigns,
}: {
  /** From the URL. The page resolves the size for it server-side. */
  audience: string;
  size: number;
  campaigns: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(sendBroadcast, IDLE_STATE);

  return (
    <form action={action} className="space-y-5">
      {/*
        Not a picker — the picker is the GET form above this one. This carries
        the audience the page was rendered for, so what posts is exactly what the
        count on screen was computed from.
      */}
      <input type="hidden" name="audience" value={audience} />

      {state.message && (
        <FormMessage tone={state.status === "error" ? "error" : "success"}>
          {state.message}
        </FormMessage>
      )}

      <Field label="Subject" htmlFor="title" errors={state.errors?.title}>
        <Input
          id="title"
          name="title"
          required
          maxLength={90}
          placeholder="Festive edit — new Banarasi arrivals"
          invalid={Boolean(state.errors?.title)}
        />
      </Field>

      <Field label="Message" htmlFor="body" errors={state.errors?.body}>
        <textarea
          id="body"
          name="body"
          rows={4}
          required
          minLength={20}
          maxLength={400}
          className="w-full border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Links to"
          htmlFor="linkUrl"
          errors={state.errors?.linkUrl}
          hint="Where tapping the notification goes. Defaults to /shop."
        >
          <Input id="linkUrl" name="linkUrl" maxLength={300} placeholder="/shop" />
        </Field>

        <Field
          label="Count against a campaign"
          htmlFor="campaignId"
          errors={state.errors?.campaignId}
          hint="Optional. Adds the recipients to that campaign's reach."
        >
          <Select id="campaignId" name="campaignId" defaultValue="">
            <option value="">None</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="rounded-md border border-warning/30 bg-warning-soft p-4">
        <p className="mb-3 text-sm text-ink-900">
          This will notify{" "}
          <span className="font-medium">
            {size} {size === 1 ? "person" : "people"}
          </span>{" "}
          in &ldquo;{CAMPAIGN_AUDIENCE_LABEL[audience] ?? audience}&rdquo;.
        </p>
        <Field
          label={`Type ${size} to confirm`}
          htmlFor="confirm"
          errors={state.errors?.confirm}
          hint="This cannot be undone — there is no unsend."
        >
          <Input
            id="confirm"
            name="confirm"
            inputMode="numeric"
            required
            className="max-w-[8rem]"
            invalid={Boolean(state.errors?.confirm)}
          />
        </Field>
      </div>

      <Button type="submit" disabled={pending || size === 0}>
        {pending
          ? "Sending…"
          : `Notify ${size} ${size === 1 ? "person" : "people"}`}
      </Button>
    </form>
  );
}
