import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { BadgeCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/dal";
import { formatPaise } from "@/lib/utils";
import { viewerTier } from "@/lib/catalogue/pricing";
import {
  PRODUCT_CARD_SELECT,
  PUBLIC_PRODUCT_WHERE,
  getApprovedSellers,
  getBanners,
} from "@/lib/catalogue/queries";
import { GST_PERCENT } from "@/lib/constants";
import { ProductGrid } from "@/components/storefront/product-card";
import { SectionHeading } from "@/components/storefront/section";

export const metadata: Metadata = {
  title: "Wholesale & bulk",
  description:
    "Trade pricing 25–35% below retail, GST invoicing and minimum order quantities from 10 metres. Register a business account with your GST number.",
  alternates: { canonical: "/wholesale" },
};

/**
 * Wholesale landing page — SRS §14, §21.
 *
 * The target of the HOME_STRIP banner seeded in prisma/seed/content.ts, and the
 * entry point into the B2B half of the marketplace. The savings figures are
 * computed from the catalogue rather than asserted: they are the real spread
 * between `priceRetail` and `priceWholesale` on approved products.
 */
export default async function WholesalePage() {
  const [user, sellers, strip, wholesaleProducts, spread, coupon] =
    await Promise.all([
      getCurrentUser(),
      getApprovedSellers(),
      getBanners("HOME_STRIP"),
      prisma.product.findMany({
        where: { ...PUBLIC_PRODUCT_WHERE, priceWholesale: { not: null } },
        select: PRODUCT_CARD_SELECT,
        orderBy: [{ minOrderQty: "desc" }, { id: "asc" }],
        take: 4,
      }),
      prisma.product.findMany({
        where: { ...PUBLIC_PRODUCT_WHERE, priceWholesale: { not: null } },
        select: { priceRetail: true, priceWholesale: true, minOrderQty: true },
      }),
      prisma.coupon.findFirst({
        where: { eligibility: "WHOLESALE", isActive: true },
        select: { code: true, discountValue: true, minOrderValue: true },
      }),
    ]);

  const banner = strip[0];
  const savings = savingsRange(spread);
  // The smallest MOQ that is actually a minimum. Most of the catalogue is
  // one-off handloom pieces at 1, and quoting "from 1 unit" would describe a
  // restriction the marketplace does not impose.
  const realMoqs = spread.map((p) => p.minOrderQty).filter((q) => q > 1);
  const lowestMoq = realMoqs.length > 0 ? Math.min(...realMoqs) : null;

  return (
    <div>
      {/* ---- Hero ---- */}
      <section className="relative isolate overflow-hidden bg-ink-900">
        {banner && (
          <>
            <Image
              src={banner.imageUrl}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-ink-900/90 via-ink-900/70 to-ink-900/30"
            />
          </>
        )}

        <div className="relative mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <p className="mb-4 inline-flex items-center gap-3 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-gold-300">
            <span aria-hidden="true" className="h-px w-7 bg-gold-400" />
            For businesses
          </p>
          <h1 className="max-w-2xl font-display text-4xl leading-[1.1] text-ivory-50 sm:text-5xl">
            Buy at trade prices, direct from the weaving clusters
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-ivory-100/80 sm:text-base">
            Boutiques, exporters and tailoring units buy the same catalogue at
            wholesale rates, with GST invoicing
            {lowestMoq
              ? ` and minimum order quantities from ${lowestMoq} metres on running fabric.`
              : "."}
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/register?type=wholesale"
              className="inline-flex h-12 items-center bg-ivory-50 px-8 text-xs font-medium uppercase tracking-[0.16em] text-ink-900 transition-colors hover:bg-gold-300"
            >
              Register a business account
            </Link>
            <Link
              href="/shop"
              className="inline-flex h-12 items-center border border-ivory-100/40 px-8 text-xs font-medium uppercase tracking-[0.16em] text-ivory-50 transition-colors hover:border-ivory-50"
            >
              Browse the catalogue
            </Link>
          </div>
        </div>
      </section>

      {/* ---- Numbers ---- */}
      <section className="border-b border-ivory-400 bg-ivory-50">
        <div className="mx-auto grid max-w-7xl gap-px bg-ivory-400 px-5 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <Stat
            value={`${savings.min}–${savings.max}%`}
            label="Below retail"
            detail="Real spread across the current catalogue"
          />
          <Stat
            value={`${spread.length}`}
            label="Products at trade price"
            detail="Every approved listing carries a wholesale rate"
          />
          <Stat
            value={`${sellers.length}`}
            label="Verified sellers"
            detail="KYC-checked manufacturers and co-operatives"
          />
          <Stat
            value={`${GST_PERCENT}%`}
            label="GST on textiles"
            detail="Invoiced against your registered GSTIN"
          />
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps to trade pricing"
          align="center"
        />

        <ol className="grid gap-8 md:grid-cols-3">
          {[
            {
              title: "Register with your GSTIN",
              body: "Choose a wholesale account and enter your GST number. It is required — trade pricing is only available to registered businesses.",
            },
            {
              title: "We verify the business",
              body: "Our team checks the GSTIN against your business details. Verification is usually complete within one working day.",
            },
            {
              title: "Prices change everywhere",
              body: "Once approved, the whole catalogue shows your trade price and the minimum order quantity in place of retail pricing. Nothing else changes.",
            },
          ].map((step, index) => (
            <li key={step.title} className="border-t-2 border-gold-400 pt-5">
              <p className="mb-2 font-display text-3xl text-gold-500">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mb-2 font-display text-lg">{step.title}</h3>
              <p className="text-sm leading-relaxed text-ink-400">{step.body}</p>
            </li>
          ))}
        </ol>

        {coupon && (
          <p className="mx-auto mt-12 max-w-xl border border-gold-400 bg-ivory-50 px-6 py-5 text-center text-sm text-ink-500">
            <span className="font-medium text-ink-900">
              {coupon.discountValue}% off
            </span>{" "}
            bulk orders above {formatPaise(coupon.minOrderValue)} with code{" "}
            <span className="font-mono text-brand-600">{coupon.code}</span>
          </p>
        )}
      </section>

      {/* ---- Sellers ---- */}
      <section className="border-t border-ivory-400 bg-ivory-50">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <SectionHeading
            eyebrow="Who you buy from"
            title="Verified sellers"
            description="Every seller on Saawariya has passed KYC verification. You buy from them directly, and their name is on your invoice."
          />

          <ul className="grid gap-px bg-ivory-400 sm:grid-cols-2 lg:grid-cols-4">
            {sellers.map((seller) => (
              <li key={seller.id} className="bg-ivory-50 p-6">
                <p className="flex items-start gap-2 font-display text-lg leading-snug">
                  {seller.businessName}
                  <BadgeCheck
                    aria-label="Verified"
                    className="mt-1 h-4 w-4 shrink-0 text-success"
                  />
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  {seller.city}, {seller.state}
                </p>
                {seller.description && (
                  <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-ink-400">
                    {seller.description}
                  </p>
                )}
                <p className="mt-4 text-[0.6875rem] uppercase tracking-[0.1em] text-gold-500">
                  {seller._count.products}{" "}
                  {seller._count.products === 1 ? "product" : "products"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---- Bulk-friendly products ---- */}
      {wholesaleProducts.length > 0 && (
        <section className="border-t border-ivory-400">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
            <SectionHeading
              eyebrow="Bulk ready"
              title="Highest minimum order quantities"
              description="Running fabric and repeatable pieces, listed with the largest MOQs in the catalogue — the lines boutiques reorder."
              action={{ href: "/shop/fabric-by-the-metre", label: "Fabric by the metre" }}
            />
            <ProductGrid products={wholesaleProducts} tier={viewerTier(user)} />
          </div>
        </section>
      )}

      {/* ---- CTA ---- */}
      <section className="border-t border-ivory-400 bg-brand-900">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-5 py-16 text-center lg:px-8">
          <h2 className="max-w-xl font-display text-3xl leading-tight text-ivory-50">
            Ready to buy at trade prices?
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-ivory-100/70">
            Register with your GST number. Questions first? Write to
            sellers@saawariya.example or read the{" "}
            <Link
              href="/page/faq"
              className="text-gold-300 underline underline-offset-4"
            >
              wholesale FAQ
            </Link>
            .
          </p>
          <Link
            href="/register?type=wholesale"
            className="inline-flex h-12 items-center bg-gold-400 px-8 text-xs font-medium uppercase tracking-[0.16em] text-ink-900 transition-colors hover:bg-gold-300"
          >
            Register a business account
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({
  value,
  label,
  detail,
}: {
  value: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="bg-ivory-50 px-6 py-8 text-center">
      <p className="font-display text-3xl text-brand-600">{value}</p>
      <p className="mt-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-900">
        {label}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-400">{detail}</p>
    </div>
  );
}

/**
 * The real discount range, rounded down/up to whole percent. Stating a range
 * the catalogue does not actually offer would be the kind of claim a client
 * checks.
 */
function savingsRange(
  products: { priceRetail: number; priceWholesale: number | null }[],
): { min: number; max: number } {
  const percentages = products
    .filter((p) => p.priceWholesale !== null && p.priceRetail > 0)
    .map((p) => ((p.priceRetail - p.priceWholesale!) / p.priceRetail) * 100);

  if (percentages.length === 0) return { min: 0, max: 0 };

  return {
    min: Math.floor(Math.min(...percentages)),
    max: Math.ceil(Math.max(...percentages)),
  };
}
