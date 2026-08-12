import type { Metadata } from "next";
import Link from "next/link";
import { requireSeller } from "@/lib/seller/context";
import { listAssignableCategories } from "@/lib/seller/products";
import { ProductForm } from "@/components/seller/product-form";

export const metadata: Metadata = { title: "Add a product" };

export default async function NewProductPage() {
  await requireSeller("/seller/products/new");
  const categories = await listAssignableCategories();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/seller/products"
        className="mb-5 inline-block text-xs font-medium uppercase tracking-[0.14em] text-ink-400 transition-colors hover:text-brand-600"
      >
        ← Products
      </Link>

      <h1 className="mb-3 font-display text-3xl">Add a product</h1>
      <p className="mb-10 max-w-xl text-sm leading-relaxed text-ink-400">
        This is saved as a draft. You can add images and submit it for approval
        on the next screen — nothing reaches the storefront until our team has
        reviewed it.
      </p>

      <ProductForm categories={categories} />
    </div>
  );
}
