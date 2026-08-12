"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { saveProduct } from "@/app/actions/seller-products";
import {
  FABRICS,
  OCCASIONS,
  PATTERNS,
  WORK_TYPES,
} from "@/lib/constants";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";

export type ProductRecord = {
  id: string;
  name: string;
  sku: string;
  description: string;
  categoryId: string;
  brand: string | null;
  collection: string | null;
  fabric: string | null;
  pattern: string | null;
  occasion: string | null;
  workType: string | null;
  color: string | null;
  weightGrams: number | null;
  priceRetail: number;
  priceWholesale: number | null;
  priceOffer: number | null;
  minOrderQty: number;
  maxOrderQty: number;
};

/** Paise back to the rupees a seller typed, for the form's default values. */
const toRupees = (paise: number | null | undefined) =>
  paise === null || paise === undefined ? "" : String(paise / 100);

export function ProductForm({
  product,
  categories,
}: {
  product?: ProductRecord | null;
  categories: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveProduct, IDLE_STATE);

  /**
   * A create lands on the edit page for the row it just made, so the seller can
   * add images and submit for approval without hunting for it in the list.
   * Done during render rather than in an effect — React 19 lints setState in
   * useEffect, and this is the same pattern AddressForm uses for its callback.
   */
  if (state.status === "success" && state.productId) {
    const target = `/seller/products/${state.productId}`;
    queueMicrotask(() => router.replace(target));
  }

  const errors = state.errors ?? {};

  return (
    <form action={action} className="space-y-8">
      {product?.id && <input type="hidden" name="id" value={product.id} />}

      {state.status === "error" && state.message && (
        <FormMessage>{state.message}</FormMessage>
      )}
      {state.status === "success" && state.message && (
        <FormMessage tone="success">{state.message}</FormMessage>
      )}

      {/* ---- Identity ---- */}
      <section className="space-y-5">
        <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Product
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" errors={errors.name}>
            <Input
              id="name"
              name="name"
              defaultValue={product?.name ?? ""}
              invalid={Boolean(errors.name)}
              required
            />
          </Field>

          <Field
            label="SKU"
            htmlFor="sku"
            errors={errors.sku}
            hint="Your own stock code. Letters, numbers and hyphens."
          >
            <Input
              id="sku"
              name="sku"
              defaultValue={product?.sku ?? ""}
              invalid={Boolean(errors.sku)}
              required
            />
          </Field>
        </div>

        <Field
          label="Category"
          htmlFor="categoryId"
          errors={errors.categoryId}
          hint="Products are listed under a sub-category so shoppers can browse to them."
        >
          <Select
            id="categoryId"
            name="categoryId"
            defaultValue={product?.categoryId ?? ""}
            invalid={Boolean(errors.categoryId)}
            required
          >
            <option value="">Choose…</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Description"
          htmlFor="description"
          errors={errors.description}
        >
          <textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={product?.description ?? ""}
            required
            className="w-full border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-900 transition-colors duration-200 focus:border-brand-600 focus:outline-none"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Brand" htmlFor="brand" errors={errors.brand}>
            <Input
              id="brand"
              name="brand"
              defaultValue={product?.brand ?? ""}
              invalid={Boolean(errors.brand)}
            />
          </Field>
          <Field
            label="Collection"
            htmlFor="collection"
            errors={errors.collection}
          >
            <Input
              id="collection"
              name="collection"
              defaultValue={product?.collection ?? ""}
              invalid={Boolean(errors.collection)}
            />
          </Field>
        </div>
      </section>

      {/* ---- Textile attributes ---- */}
      <section className="space-y-5">
        <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Textile details
        </h2>
        <p className="text-xs leading-relaxed text-ink-400">
          These drive the shop filters. The more you fill in, the more searches
          your product appears in.
        </p>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AttributeSelect
            label="Fabric"
            name="fabric"
            options={FABRICS}
            value={product?.fabric}
            errors={errors.fabric}
          />
          <AttributeSelect
            label="Pattern"
            name="pattern"
            options={PATTERNS}
            value={product?.pattern}
            errors={errors.pattern}
          />
          <AttributeSelect
            label="Occasion"
            name="occasion"
            options={OCCASIONS}
            value={product?.occasion}
            errors={errors.occasion}
          />
          <AttributeSelect
            label="Work type"
            name="workType"
            options={WORK_TYPES}
            value={product?.workType}
            errors={errors.workType}
          />

          <Field label="Colour" htmlFor="color" errors={errors.color}>
            <Input
              id="color"
              name="color"
              defaultValue={product?.color ?? ""}
              invalid={Boolean(errors.color)}
              placeholder="e.g. Deep Maroon"
            />
          </Field>

          <Field
            label="Weight (grams)"
            htmlFor="weightGrams"
            errors={errors.weightGrams}
          >
            <Input
              id="weightGrams"
              name="weightGrams"
              inputMode="numeric"
              defaultValue={product?.weightGrams ?? ""}
              invalid={Boolean(errors.weightGrams)}
            />
          </Field>
        </div>
      </section>

      {/* ---- Pricing ---- */}
      <section className="space-y-5">
        <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Pricing
        </h2>
        <p className="text-xs leading-relaxed text-ink-400">
          All prices in rupees, inclusive of GST — that is how they are shown to
          shoppers, and how tax is worked out at checkout.
        </p>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field
            label="Retail price"
            htmlFor="priceRetail"
            errors={errors.priceRetail}
          >
            <Input
              id="priceRetail"
              name="priceRetail"
              inputMode="decimal"
              defaultValue={toRupees(product?.priceRetail)}
              invalid={Boolean(errors.priceRetail)}
              required
            />
          </Field>

          <Field
            label="Offer price"
            htmlFor="priceOffer"
            errors={errors.priceOffer}
            hint="Optional. Must be below retail."
          >
            <Input
              id="priceOffer"
              name="priceOffer"
              inputMode="decimal"
              defaultValue={toRupees(product?.priceOffer)}
              invalid={Boolean(errors.priceOffer)}
            />
          </Field>

          <Field
            label="Wholesale price"
            htmlFor="priceWholesale"
            errors={errors.priceWholesale}
            hint="Optional. Shown only to trade accounts."
          >
            <Input
              id="priceWholesale"
              name="priceWholesale"
              inputMode="decimal"
              defaultValue={toRupees(product?.priceWholesale)}
              invalid={Boolean(errors.priceWholesale)}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Minimum order quantity"
            htmlFor="minOrderQty"
            errors={errors.minOrderQty}
            hint="Enforced at checkout. Use this for fabric sold by the metre."
          >
            <Input
              id="minOrderQty"
              name="minOrderQty"
              inputMode="numeric"
              defaultValue={product?.minOrderQty ?? 1}
              invalid={Boolean(errors.minOrderQty)}
            />
          </Field>

          <Field
            label="Maximum order quantity"
            htmlFor="maxOrderQty"
            errors={errors.maxOrderQty}
          >
            <Input
              id="maxOrderQty"
              name="maxOrderQty"
              inputMode="numeric"
              defaultValue={product?.maxOrderQty ?? 100}
              invalid={Boolean(errors.maxOrderQty)}
            />
          </Field>
        </div>
      </section>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : product ? "Save changes" : "Create draft"}
      </Button>
    </form>
  );
}

function AttributeSelect({
  label,
  name,
  options,
  value,
  errors,
}: {
  label: string;
  name: string;
  options: readonly string[];
  value: string | null | undefined;
  errors?: string[];
}) {
  return (
    <Field label={label} htmlFor={name} errors={errors}>
      <Select
        id={name}
        name={name}
        defaultValue={value ?? ""}
        invalid={Boolean(errors)}
      >
        <option value="">Not specified</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </Field>
  );
}
