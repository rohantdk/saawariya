"use client";

import { useActionState, useState } from "react";
import { saveCoupon } from "@/app/actions/marketing";
import {
  COUPON_ELIGIBILITY,
  COUPON_ELIGIBILITY_LABEL,
  DISCOUNT_TYPE,
  DISCOUNT_TYPE_LABEL,
} from "@/lib/constants";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { toDateTimeLocal } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";

/**
 * Create or edit a coupon — SRS §126.
 *
 * **Amounts are typed in rupees and stored in paise.** Every other panel takes
 * paise straight from a seeded row; this is the first screen where a person
 * types money, and asking a marketer to enter 50000 for ₹500 is how a coupon
 * ends up a hundred times too generous. The conversion happens once, in
 * `couponSchema`, so nothing downstream ever sees rupees.
 *
 * The value field changes with the discount type, because `discountValue` means
 * two different things — a percentage or an amount — and one box labelled
 * "value" would be a trap.
 *
 * **The select is uncontrolled**, and that matters. React 19 resets a form once
 * its action completes, including on a failed submission: an uncontrolled field
 * returns to its `defaultValue`, but a *controlled* one snaps back to whatever
 * the server rendered while the React state stays where it was — so the control
 * shows one thing and posts another. The state below therefore decides only
 * which field is *drawn*; the value that posts is always the one in the select
 * the user is looking at. The broadcast form has the full account of how this
 * was found.
 */
export function CouponForm({
  coupon,
}: {
  coupon?: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
    minOrderValue: number;
    maxDiscount: number | null;
    usageLimit: number | null;
    perCustomerLimit: number;
    eligibility: string;
    isActive: boolean;
    startsAt: Date;
    endsAt: Date;
  };
}) {
  const [state, action, pending] = useActionState(saveCoupon, IDLE_STATE);
  const [discountType, setDiscountType] = useState(
    coupon?.discountType ?? DISCOUNT_TYPE.PERCENTAGE,
  );

  const rupees = (paise: number | null | undefined) =>
    paise === null || paise === undefined ? "" : String(paise / 100);

  return (
    <form action={action} className="space-y-5">
      {coupon && <input type="hidden" name="id" value={coupon.id} />}

      {state.message && (
        <FormMessage tone={state.status === "error" ? "error" : "success"}>
          {state.message}
        </FormMessage>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Code"
          htmlFor="code"
          errors={state.errors?.code}
          hint="Capitals and numbers. The cart uppercases whatever a shopper types."
        >
          <Input
            id="code"
            name="code"
            defaultValue={coupon?.code}
            required
            maxLength={24}
            placeholder="FESTIVE500"
            invalid={Boolean(state.errors?.code)}
          />
        </Field>

        <Field
          label="Discount type"
          htmlFor="discountType"
          errors={state.errors?.discountType}
        >
          <Select
            id="discountType"
            name="discountType"
            defaultValue={coupon?.discountType ?? DISCOUNT_TYPE.PERCENTAGE}
            onChange={(event) => setDiscountType(event.target.value)}
          >
            {Object.values(DISCOUNT_TYPE).map((type) => (
              <option key={type} value={type}>
                {DISCOUNT_TYPE_LABEL[type]}
              </option>
            ))}
          </Select>
        </Field>

        {discountType === DISCOUNT_TYPE.PERCENTAGE && (
          <Field
            label="Percentage off"
            htmlFor="percentValue"
            errors={state.errors?.percentValue}
          >
            <Input
              id="percentValue"
              name="percentValue"
              type="number"
              min={1}
              max={100}
              defaultValue={
                coupon?.discountType === DISCOUNT_TYPE.PERCENTAGE
                  ? coupon.discountValue
                  : ""
              }
              invalid={Boolean(state.errors?.percentValue)}
            />
          </Field>
        )}

        {discountType === DISCOUNT_TYPE.FIXED && (
          <Field
            label="Amount off (₹)"
            htmlFor="fixedValue"
            errors={state.errors?.fixedValue}
          >
            <Input
              id="fixedValue"
              name="fixedValue"
              type="number"
              min={1}
              step="0.01"
              defaultValue={
                coupon?.discountType === DISCOUNT_TYPE.FIXED
                  ? rupees(coupon.discountValue)
                  : ""
              }
              invalid={Boolean(state.errors?.fixedValue)}
            />
          </Field>
        )}

        {discountType === DISCOUNT_TYPE.FREE_SHIPPING && (
          <div className="flex items-end">
            <p className="text-sm text-ink-400">
              Free shipping takes the delivery charge off. There is no amount to
              set.
            </p>
          </div>
        )}

        <Field
          label="Minimum order (₹)"
          htmlFor="minOrderValue"
          errors={state.errors?.minOrderValue}
          hint="Leave at 0 for no minimum."
        >
          <Input
            id="minOrderValue"
            name="minOrderValue"
            type="number"
            min={0}
            step="0.01"
            defaultValue={rupees(coupon?.minOrderValue ?? 0)}
            invalid={Boolean(state.errors?.minOrderValue)}
          />
        </Field>

        {discountType === DISCOUNT_TYPE.PERCENTAGE && (
          <Field
            label="Cap the discount at (₹)"
            htmlFor="maxDiscount"
            errors={state.errors?.maxDiscount}
            hint="Optional. Stops 20% off a ₹68,000 saree costing ₹13,600."
          >
            <Input
              id="maxDiscount"
              name="maxDiscount"
              type="number"
              min={0}
              step="0.01"
              defaultValue={rupees(coupon?.maxDiscount)}
              invalid={Boolean(state.errors?.maxDiscount)}
            />
          </Field>
        )}

        <Field
          label="Who can use it"
          htmlFor="eligibility"
          errors={state.errors?.eligibility}
        >
          <Select
            id="eligibility"
            name="eligibility"
            defaultValue={coupon?.eligibility ?? COUPON_ELIGIBILITY.ALL}
          >
            {Object.values(COUPON_ELIGIBILITY).map((value) => (
              <option key={value} value={value}>
                {COUPON_ELIGIBILITY_LABEL[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Total redemptions"
          htmlFor="usageLimit"
          errors={state.errors?.usageLimit}
          hint="0 means unlimited."
        >
          <Input
            id="usageLimit"
            name="usageLimit"
            type="number"
            min={0}
            defaultValue={coupon?.usageLimit ?? 0}
            invalid={Boolean(state.errors?.usageLimit)}
          />
        </Field>

        <Field
          label="Uses per customer"
          htmlFor="perCustomerLimit"
          errors={state.errors?.perCustomerLimit}
        >
          <Input
            id="perCustomerLimit"
            name="perCustomerLimit"
            type="number"
            min={1}
            defaultValue={coupon?.perCustomerLimit ?? 1}
            invalid={Boolean(state.errors?.perCustomerLimit)}
          />
        </Field>

        <Field label="Starts" htmlFor="startsAt" errors={state.errors?.startsAt}>
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={toDateTimeLocal(coupon?.startsAt ?? new Date())}
            invalid={Boolean(state.errors?.startsAt)}
          />
        </Field>

        <Field label="Ends" htmlFor="endsAt" errors={state.errors?.endsAt}>
          <Input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            required
            defaultValue={toDateTimeLocal(coupon?.endsAt)}
            invalid={Boolean(state.errors?.endsAt)}
          />
        </Field>
      </div>

      <label className="flex items-center gap-3 text-sm text-ink-900">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={coupon?.isActive ?? true}
          className="h-4 w-4 accent-[var(--color-brand-600)]"
        />
        Switched on — shoppers can redeem it inside the dates above
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : coupon ? "Save changes" : "Create coupon"}
      </Button>
    </form>
  );
}
