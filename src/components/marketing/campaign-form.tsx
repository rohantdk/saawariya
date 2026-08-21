"use client";

import { useActionState } from "react";
import { moveCampaign, saveCampaign } from "@/app/actions/marketing";
import {
  CAMPAIGN_AUDIENCE,
  CAMPAIGN_AUDIENCE_LABEL,
} from "@/lib/constants";
import {
  CAMPAIGN_MOVE_LABEL,
  campaignMovesFrom,
} from "@/lib/marketing/campaign-states";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { toDateTimeLocal } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";

/**
 * Create or edit a campaign — SRS §127.
 *
 * The moves come from `campaignMovesFrom`, which is a **pure** module — the
 * queries live in `src/lib/marketing/campaigns.ts`, which imports `prisma`, and
 * a Client Component importing a value from a `server-only` module pulls
 * `better-sqlite3` into the browser bundle. `tsc` and `eslint` both pass; only
 * `next build` catches it. That has broken this build twice.
 */
export function CampaignForm({
  campaign,
}: {
  campaign?: {
    id: string;
    name: string;
    description: string | null;
    bannerUrl: string | null;
    offerDetail: string | null;
    audience: string;
    status: string;
    startsAt: Date;
    endsAt: Date;
  };
}) {
  const [state, action, pending] = useActionState(saveCampaign, IDLE_STATE);

  return (
    <form action={action} className="space-y-5">
      {campaign && <input type="hidden" name="id" value={campaign.id} />}

      {state.message && (
        <FormMessage tone={state.status === "error" ? "error" : "success"}>
          {state.message}
        </FormMessage>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Name"
          htmlFor="name"
          errors={state.errors?.name}
          className="sm:col-span-2"
        >
          <Input
            id="name"
            name="name"
            defaultValue={campaign?.name}
            required
            maxLength={80}
            invalid={Boolean(state.errors?.name)}
          />
        </Field>

        <Field
          label="What it is"
          htmlFor="description"
          errors={state.errors?.description}
          className="sm:col-span-2"
        >
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={500}
            defaultValue={campaign?.description ?? ""}
            className="rounded-md w-full border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
          />
        </Field>

        <Field
          label="The offer"
          htmlFor="offerDetail"
          errors={state.errors?.offerDetail}
          hint="One line, e.g. “20% off all Chanderi with code CHANDERI20”."
          className="sm:col-span-2"
        >
          <Input
            id="offerDetail"
            name="offerDetail"
            defaultValue={campaign?.offerDetail ?? ""}
            maxLength={300}
          />
        </Field>

        <Field
          label="Audience"
          htmlFor="audience"
          errors={state.errors?.audience}
        >
          <Select
            id="audience"
            name="audience"
            defaultValue={campaign?.audience ?? CAMPAIGN_AUDIENCE.ALL}
          >
            {Object.values(CAMPAIGN_AUDIENCE).map((audience) => (
              <option key={audience} value={audience}>
                {CAMPAIGN_AUDIENCE_LABEL[audience]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Banner image"
          htmlFor="bannerUrl"
          errors={state.errors?.bannerUrl}
          hint="Optional path under /public."
        >
          <Input
            id="bannerUrl"
            name="bannerUrl"
            defaultValue={campaign?.bannerUrl ?? ""}
            maxLength={300}
          />
        </Field>

        <Field label="Starts" htmlFor="startsAt" errors={state.errors?.startsAt}>
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={toDateTimeLocal(campaign?.startsAt ?? new Date())}
            invalid={Boolean(state.errors?.startsAt)}
          />
        </Field>

        <Field label="Ends" htmlFor="endsAt" errors={state.errors?.endsAt}>
          <Input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            required
            defaultValue={toDateTimeLocal(campaign?.endsAt)}
            invalid={Boolean(state.errors?.endsAt)}
          />
        </Field>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : campaign ? "Save changes" : "Create as draft"}
      </Button>
    </form>
  );
}

/** The status moves for one campaign, drawn from the same pure table. */
export function CampaignStatusActions({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(moveCampaign, IDLE_STATE);
  const moves = campaignMovesFrom(status);

  if (moves.length === 0) {
    return (
      <p className="text-sm text-ink-400">
        This campaign is {status.toLowerCase()} — its performance figures
        describe what it did, so it is not restarted from here.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={campaignId} />

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

      <div className="flex flex-wrap gap-2">
        {moves.map((move, index) => (
          <Button
            key={move}
            type="submit"
            name="status"
            value={move}
            size="sm"
            variant={
              move === "CANCELLED"
                ? "danger"
                : index === 0
                  ? "primary"
                  : "secondary"
            }
            disabled={pending}
          >
            {pending ? "Working…" : CAMPAIGN_MOVE_LABEL[move]}
          </Button>
        ))}
      </div>
    </form>
  );
}
