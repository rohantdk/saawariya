"use client";

import { useActionState } from "react";
import { saveSellerProfile } from "@/app/actions/seller-profile";
import {
  INDIAN_STATES,
  SELLER_BUSINESS_TYPES,
  SELLER_BUSINESS_TYPE_LABEL,
} from "@/lib/constants";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";

export type SellerProfileRecord = {
  businessName: string;
  ownerName: string;
  businessType: string;
  description: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  pickupAddress: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
};

/**
 * One business-details form, used by both `/seller/onboarding` (where it
 * creates the Seller row) and `/seller/profile` (where it edits it). The action
 * decides which — the form does not need to know, and duplicating it would mean
 * two GSTIN validations to keep in step.
 *
 * Bank and KYC numbers are plain text inputs on purpose: this build takes no
 * payments and stores no card data, and masking a field the seller typed
 * themselves only makes it harder to check for typos.
 */
export function SellerProfileForm({
  profile,
  submitLabel = "Save details",
}: {
  profile?: SellerProfileRecord | null;
  submitLabel?: string;
}) {
  const [state, action, pending] = useActionState(
    saveSellerProfile,
    IDLE_STATE,
  );
  const errors = state.errors ?? {};

  return (
    <form action={action} className="space-y-8">
      {state.status === "error" && state.message && (
        <FormMessage>{state.message}</FormMessage>
      )}
      {state.status === "success" && state.message && (
        <FormMessage tone="success">{state.message}</FormMessage>
      )}

      <section className="space-y-5">
        <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Business
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Business name"
            htmlFor="businessName"
            errors={errors.businessName}
          >
            <Input
              id="businessName"
              name="businessName"
              defaultValue={profile?.businessName ?? ""}
              invalid={Boolean(errors.businessName)}
              required
            />
          </Field>

          <Field label="Owner name" htmlFor="ownerName" errors={errors.ownerName}>
            <Input
              id="ownerName"
              name="ownerName"
              defaultValue={profile?.ownerName ?? ""}
              invalid={Boolean(errors.ownerName)}
              required
            />
          </Field>

          <Field
            label="Business type"
            htmlFor="businessType"
            errors={errors.businessType}
          >
            <Select
              id="businessType"
              name="businessType"
              defaultValue={profile?.businessType ?? ""}
              invalid={Boolean(errors.businessType)}
              required
            >
              <option value="">Choose…</option>
              {SELLER_BUSINESS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {SELLER_BUSINESS_TYPE_LABEL[type]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="GSTIN"
            htmlFor="gstNumber"
            errors={errors.gstNumber}
            hint="15 characters, e.g. 27AAPFU0939F1ZV"
          >
            <Input
              id="gstNumber"
              name="gstNumber"
              defaultValue={profile?.gstNumber ?? ""}
              invalid={Boolean(errors.gstNumber)}
              autoCapitalize="characters"
            />
          </Field>

          <Field
            label="PAN"
            htmlFor="panNumber"
            errors={errors.panNumber}
            hint="10 characters, e.g. AAPFU0939F"
          >
            <Input
              id="panNumber"
              name="panNumber"
              defaultValue={profile?.panNumber ?? ""}
              invalid={Boolean(errors.panNumber)}
              autoCapitalize="characters"
            />
          </Field>
        </div>

        <Field
          label="About the business"
          htmlFor="description"
          errors={errors.description}
          hint="Shown on your storefront listings."
        >
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={profile?.description ?? ""}
            className="rounded-md w-full border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-900 transition-colors duration-200 focus:border-brand-600 focus:outline-none"
          />
        </Field>
      </section>

      <section className="space-y-5">
        <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Address &amp; pickup
        </h2>

        <Field
          label="Address"
          htmlFor="addressLine"
          errors={errors.addressLine}
        >
          <Input
            id="addressLine"
            name="addressLine"
            defaultValue={profile?.addressLine ?? ""}
            invalid={Boolean(errors.addressLine)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="City" htmlFor="city" errors={errors.city}>
            <Input
              id="city"
              name="city"
              defaultValue={profile?.city ?? ""}
              invalid={Boolean(errors.city)}
            />
          </Field>

          <Field label="State" htmlFor="state" errors={errors.state}>
            <Select
              id="state"
              name="state"
              defaultValue={profile?.state ?? ""}
              invalid={Boolean(errors.state)}
            >
              <option value="">Choose…</option>
              {INDIAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="PIN code" htmlFor="pinCode" errors={errors.pinCode}>
            <Input
              id="pinCode"
              name="pinCode"
              inputMode="numeric"
              defaultValue={profile?.pinCode ?? ""}
              invalid={Boolean(errors.pinCode)}
            />
          </Field>
        </div>

        <Field
          label="Pickup address"
          htmlFor="pickupAddress"
          errors={errors.pickupAddress}
          hint="Where our warehouse team collects stock from. Leave blank to use the address above."
        >
          <Input
            id="pickupAddress"
            name="pickupAddress"
            defaultValue={profile?.pickupAddress ?? ""}
            invalid={Boolean(errors.pickupAddress)}
          />
        </Field>
      </section>

      <section className="space-y-5">
        <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Settlement bank account
        </h2>
        <p className="text-xs leading-relaxed text-ink-400">
          Payouts for delivered orders are credited here. Saawariya charges
          commission on the order value and settles the remainder.
        </p>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field
            label="Account name"
            htmlFor="bankAccountName"
            errors={errors.bankAccountName}
          >
            <Input
              id="bankAccountName"
              name="bankAccountName"
              defaultValue={profile?.bankAccountName ?? ""}
              invalid={Boolean(errors.bankAccountName)}
            />
          </Field>

          <Field
            label="Account number"
            htmlFor="bankAccountNumber"
            errors={errors.bankAccountNumber}
          >
            <Input
              id="bankAccountNumber"
              name="bankAccountNumber"
              inputMode="numeric"
              defaultValue={profile?.bankAccountNumber ?? ""}
              invalid={Boolean(errors.bankAccountNumber)}
            />
          </Field>

          <Field label="IFSC" htmlFor="bankIfsc" errors={errors.bankIfsc}>
            <Input
              id="bankIfsc"
              name="bankIfsc"
              defaultValue={profile?.bankIfsc ?? ""}
              invalid={Boolean(errors.bankIfsc)}
              autoCapitalize="characters"
            />
          </Field>
        </div>
      </section>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
