"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { saveBanner } from "@/app/actions/marketing";
import { BANNER_POSITION, BANNER_POSITION_LABEL } from "@/lib/constants";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { toDateTimeLocal } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";

/**
 * Create or edit a banner — SRS §125.
 *
 * There is no upload widget, and that is a deliberate omission rather than a
 * gap: catalogue imagery is committed to the repo and served from
 * `/catalogue/…` so the client can unzip the project and run it offline. A file
 * picker with nowhere to put the file is exactly the kind of fake control this
 * build does not ship. The field takes a path and previews it, so a typo is
 * visible here rather than on the homepage.
 *
 * **The image field is uncontrolled**, with the state below driving only the
 * preview. React 19 resets a form once its action completes, and a controlled
 * input snaps back to the server-rendered value while React state stays put — so
 * the box would show one path and post another. See the broadcast form for the
 * full account of how that was found.
 */
export function BannerForm({
  banner,
}: {
  banner?: {
    id: string;
    title: string;
    subtitle: string | null;
    imageUrl: string;
    linkUrl: string | null;
    position: string;
    sortOrder: number;
    isActive: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
  };
}) {
  const [state, action, pending] = useActionState(saveBanner, IDLE_STATE);
  const [imageUrl, setImageUrl] = useState(banner?.imageUrl ?? "");

  return (
    <form action={action} className="space-y-5">
      {banner && <input type="hidden" name="id" value={banner.id} />}

      {state.message && (
        <FormMessage tone={state.status === "error" ? "error" : "success"}>
          {state.message}
        </FormMessage>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Title"
          htmlFor="title"
          errors={state.errors?.title}
          className="sm:col-span-2"
        >
          <Input
            id="title"
            name="title"
            defaultValue={banner?.title}
            required
            maxLength={80}
            invalid={Boolean(state.errors?.title)}
          />
        </Field>

        <Field
          label="Subtitle"
          htmlFor="subtitle"
          errors={state.errors?.subtitle}
          className="sm:col-span-2"
        >
          <Input
            id="subtitle"
            name="subtitle"
            defaultValue={banner?.subtitle ?? ""}
            maxLength={160}
            invalid={Boolean(state.errors?.subtitle)}
          />
        </Field>

        <Field
          label="Image path"
          htmlFor="imageUrl"
          errors={state.errors?.imageUrl}
          hint="A path under /public, e.g. /catalogue/banner-festive.jpg"
          className="sm:col-span-2"
        >
          <Input
            id="imageUrl"
            name="imageUrl"
            defaultValue={banner?.imageUrl ?? ""}
            onChange={(event) => setImageUrl(event.target.value)}
            required
            maxLength={300}
            invalid={Boolean(state.errors?.imageUrl)}
          />
        </Field>

        <Field
          label="Links to"
          htmlFor="linkUrl"
          errors={state.errors?.linkUrl}
          hint="Where the banner takes a shopper. Leave blank for a banner that is not clickable."
          className="sm:col-span-2"
        >
          <Input
            id="linkUrl"
            name="linkUrl"
            defaultValue={banner?.linkUrl ?? ""}
            maxLength={300}
            placeholder="/shop/sarees"
            invalid={Boolean(state.errors?.linkUrl)}
          />
        </Field>

        <Field label="Slot" htmlFor="position" errors={state.errors?.position}>
          <Select
            id="position"
            name="position"
            defaultValue={banner?.position ?? BANNER_POSITION.HOME_HERO}
          >
            {Object.values(BANNER_POSITION).map((position) => (
              <option key={position} value={position}>
                {BANNER_POSITION_LABEL[position]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Order in the slot"
          htmlFor="sortOrder"
          errors={state.errors?.sortOrder}
          hint="Lowest first. The homepage carousel renders in this order."
        >
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            defaultValue={banner?.sortOrder ?? 0}
            invalid={Boolean(state.errors?.sortOrder)}
          />
        </Field>

        <Field
          label="Starts"
          htmlFor="startsAt"
          errors={state.errors?.startsAt}
          hint="Optional — leave blank to start immediately."
        >
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={toDateTimeLocal(banner?.startsAt)}
            invalid={Boolean(state.errors?.startsAt)}
          />
        </Field>

        <Field
          label="Ends"
          htmlFor="endsAt"
          errors={state.errors?.endsAt}
          hint="Optional — leave blank to run until switched off."
        >
          <Input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            defaultValue={toDateTimeLocal(banner?.endsAt)}
            invalid={Boolean(state.errors?.endsAt)}
          />
        </Field>
      </div>

      {imageUrl.startsWith("/") && (
        <div>
          <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
            Preview
          </p>
          <div className="relative aspect-[3/1] w-full max-w-lg overflow-hidden rounded-md border border-ivory-400 bg-ivory-200">
            <Image
              src={imageUrl}
              alt=""
              fill
              sizes="512px"
              className="object-cover"
            />
          </div>
        </div>
      )}

      <label className="flex items-center gap-3 text-sm text-ink-900">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={banner?.isActive ?? true}
          className="h-4 w-4 accent-brand-600"
        />
        Switched on — the storefront shows it inside the dates above
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : banner ? "Save changes" : "Create banner"}
      </Button>
    </form>
  );
}
