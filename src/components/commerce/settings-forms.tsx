"use client";

import { useActionState } from "react";
import {
  changePassword,
  updateProfile,
  upgradeToWholesale,
} from "@/app/actions/account";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";

/**
 * The three settings forms. Each is its own <form> with its own action state,
 * so saving a mobile number cannot clear an unrelated password error, and a
 * failed password change does not discard edits to the profile fields.
 */

export function ProfileForm({
  defaults,
  mobileVerified,
}: {
  defaults: {
    fullName: string;
    mobile: string;
    dateOfBirth: string;
    preferredLang: string;
  };
  mobileVerified: boolean;
}) {
  const [state, action, pending] = useActionState(updateProfile, IDLE_STATE);
  const errors = state.errors ?? {};

  return (
    <form action={action} className="space-y-5">
      {state.status === "error" && state.message && (
        <FormMessage>{state.message}</FormMessage>
      )}
      {state.status === "success" && state.message && (
        <FormMessage tone="success">{state.message}</FormMessage>
      )}

      <Field label="Full name" htmlFor="fullName" errors={errors.fullName}>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={defaults.fullName}
          autoComplete="name"
          required
          invalid={Boolean(errors.fullName)}
        />
      </Field>

      <Field
        label="Mobile number"
        htmlFor="mobile"
        errors={errors.mobile}
        hint={
          mobileVerified
            ? "Verified. Changing it will need re-verification."
            : "Not yet verified."
        }
      >
        <Input
          id="mobile"
          name="mobile"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          defaultValue={defaults.mobile}
          autoComplete="tel-national"
          required
          invalid={Boolean(errors.mobile)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Date of birth"
          htmlFor="dateOfBirth"
          errors={errors.dateOfBirth}
          hint="Optional — we send a birthday offer."
        >
          <Input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            defaultValue={defaults.dateOfBirth}
            invalid={Boolean(errors.dateOfBirth)}
          />
        </Field>

        <Field
          label="Preferred language"
          htmlFor="preferredLang"
          errors={errors.preferredLang}
        >
          <Select
            id="preferredLang"
            name="preferredLang"
            defaultValue={defaults.preferredLang}
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी (Hindi)</option>
          </Select>
        </Field>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, IDLE_STATE);
  const errors = state.errors ?? {};

  return (
    <form action={action} className="space-y-5">
      {state.status === "error" && state.message && (
        <FormMessage>{state.message}</FormMessage>
      )}
      {state.status === "success" && state.message && (
        <FormMessage tone="success">{state.message}</FormMessage>
      )}

      <Field
        label="Current password"
        htmlFor="currentPassword"
        errors={errors.currentPassword}
      >
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          invalid={Boolean(errors.currentPassword)}
        />
      </Field>

      <Field
        label="New password"
        htmlFor="newPassword"
        errors={errors.newPassword}
      >
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          invalid={Boolean(errors.newPassword)}
        />
      </Field>

      <Field
        label="Confirm new password"
        htmlFor="confirmPassword"
        errors={errors.confirmPassword}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          invalid={Boolean(errors.confirmPassword)}
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Change password"}
      </Button>
    </form>
  );
}

export function WholesaleForm() {
  const [state, action, pending] = useActionState(
    upgradeToWholesale,
    IDLE_STATE,
  );

  if (state.status === "success") {
    return (
      <FormMessage tone="success">
        {state.message ?? "Trade pricing is now active."}
      </FormMessage>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {state.status === "error" && state.message && (
        <FormMessage>{state.message}</FormMessage>
      )}

      <Field
        label="GSTIN"
        htmlFor="gstNumber"
        errors={state.errors?.gstNumber}
        hint="15 characters, e.g. 29AAFCL4567R1Z8"
      >
        <Input
          id="gstNumber"
          name="gstNumber"
          maxLength={15}
          required
          placeholder="29AAFCL4567R1Z8"
          className="uppercase"
          invalid={Boolean(state.errors?.gstNumber)}
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Activating…" : "Activate trade pricing"}
      </Button>
    </form>
  );
}
