"use client";

import { useActionState } from "react";
import { saveAddress } from "@/app/actions/address";
import { ADDRESS_LABELS, INDIAN_STATES } from "@/lib/constants";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";

export type AddressRecord = {
  id: string;
  label: string;
  fullName: string;
  mobile: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pinCode: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
};

/**
 * One address form, used both in the account address book and inline at
 * checkout. Every field is bound to a label through Field, and the error
 * messages come back from the same Zod schema the action validates with, so
 * what the customer is told matches what was actually rejected.
 */
export function AddressForm({
  address,
  onDone,
  submitLabel = "Save address",
  showDefaults = true,
}: {
  address?: AddressRecord | null;
  /** Called after a successful save — lets a drawer or panel close itself. */
  onDone?: () => void;
  submitLabel?: string;
  showDefaults?: boolean;
}) {
  const [state, action, pending] = useActionState(saveAddress, IDLE_STATE);

  // Fire the callback once the server has confirmed, during render rather than
  // in an effect (React 19 lints setState inside useEffect).
  if (state.status === "success" && onDone) {
    queueMicrotask(onDone);
  }

  const errors = state.errors ?? {};

  return (
    <form action={action} className="space-y-5">
      {address?.id && <input type="hidden" name="id" value={address.id} />}

      {state.status === "error" && state.message && (
        <FormMessage>{state.message}</FormMessage>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Address name" htmlFor="label" errors={errors.label}>
          <Select
            id="label"
            name="label"
            defaultValue={address?.label ?? "Home"}
            invalid={Boolean(errors.label)}
          >
            {ADDRESS_LABELS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Recipient's name"
          htmlFor="fullName"
          errors={errors.fullName}
        >
          <Input
            id="fullName"
            name="fullName"
            defaultValue={address?.fullName ?? ""}
            autoComplete="name"
            invalid={Boolean(errors.fullName)}
            required
          />
        </Field>
      </div>

      <Field
        label="Mobile number"
        htmlFor="mobile"
        errors={errors.mobile}
        hint="We only use this for delivery updates."
      >
        <Input
          id="mobile"
          name="mobile"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          defaultValue={address?.mobile ?? ""}
          autoComplete="tel-national"
          invalid={Boolean(errors.mobile)}
          required
        />
      </Field>

      <Field
        label="Flat, house, building"
        htmlFor="line1"
        errors={errors.line1}
      >
        <Input
          id="line1"
          name="line1"
          defaultValue={address?.line1 ?? ""}
          autoComplete="address-line1"
          invalid={Boolean(errors.line1)}
          required
        />
      </Field>

      <Field
        label="Area, street, sector"
        htmlFor="line2"
        errors={errors.line2}
      >
        <Input
          id="line2"
          name="line2"
          defaultValue={address?.line2 ?? ""}
          autoComplete="address-line2"
        />
      </Field>

      <Field label="Landmark" htmlFor="landmark" errors={errors.landmark}>
        <Input
          id="landmark"
          name="landmark"
          defaultValue={address?.landmark ?? ""}
          placeholder="Optional — helps our courier find you"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="PIN code" htmlFor="pinCode" errors={errors.pinCode}>
          <Input
            id="pinCode"
            name="pinCode"
            inputMode="numeric"
            maxLength={6}
            defaultValue={address?.pinCode ?? ""}
            autoComplete="postal-code"
            invalid={Boolean(errors.pinCode)}
            required
          />
        </Field>

        <Field label="City" htmlFor="city" errors={errors.city}>
          <Input
            id="city"
            name="city"
            defaultValue={address?.city ?? ""}
            autoComplete="address-level2"
            invalid={Boolean(errors.city)}
            required
          />
        </Field>

        <Field label="State" htmlFor="state" errors={errors.state}>
          <Select
            id="state"
            name="state"
            defaultValue={address?.state ?? ""}
            invalid={Boolean(errors.state)}
            required
          >
            <option value="" disabled>
              Select a state
            </option>
            {INDIAN_STATES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {showDefaults && (
        <fieldset className="space-y-2.5">
          <legend className="sr-only">Default address settings</legend>
          <Checkbox
            name="isDefaultShipping"
            defaultChecked={address?.isDefaultShipping ?? false}
            label="Use as my default delivery address"
          />
          <Checkbox
            name="isDefaultBilling"
            defaultChecked={address?.isDefaultBilling ?? false}
            label="Use as my default billing address"
          />
        </fieldset>
      )}

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {state.status === "success" && state.message && (
          <p role="status" className="text-sm text-success">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-ink-900">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-[var(--color-brand-600)]"
      />
      {label}
    </label>
  );
}
