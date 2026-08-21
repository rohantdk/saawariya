import {
  BadgeCheck,
  ClipboardCheck,
  Headset,
  ShieldCheck,
  Truck,
  Wallet,
} from "lucide-react";
import type { CommerceSettings } from "@/lib/commerce/settings";
import { formatPaise } from "@/lib/utils";

/**
 * Why Choose Saawariya — SRS §152.
 *
 * The SRS suggests six confidence blocks, one of which is "Secure Payments".
 * **No payment gateway is connected to this build**, and the checkout says so,
 * so a badge promising secure payment processing would be the page contradicting
 * the product. Every claim below is instead something this platform provably
 * does, and each one names the mechanism a reviewer can go and check:
 *
 *   quality      → the QC desk's 16-point inspection, and its failure loop
 *   sellers      → the four-document KYC gate on seller approval
 *   listings     → product approval, and re-approval after any edit
 *   dispatch     → shipping.dispatch_days, read live from platform settings
 *   support      → the ticket queue behind /account/support
 *   money        → settlements are blocked until the parcel is delivered
 *
 * The same rule the seeded MOQ copy taught in Phase 3: marketing copy commits
 * the software to something, so it may only say what the software already does.
 * The numbers come from `Setting`, so changing dispatch days or the returns
 * window in the admin console changes this band too.
 */
export function WhySaawariya({ settings }: { settings: CommerceSettings }) {
  const blocks = [
    {
      icon: ClipboardCheck,
      title: "Checked before it ships",
      body: "Every parcel is inspected against a sixteen-point checklist in our warehouse. Anything that fails goes back to be put right — it does not go out to you.",
    },
    {
      icon: ShieldCheck,
      title: "Verified sellers only",
      body: "A weaver cannot list a single product until four documents — GSTIN, PAN, bank proof and address — have each been checked and approved.",
    },
    {
      icon: BadgeCheck,
      title: "Approved listings",
      body: "Every product is reviewed before it goes live, and any edit to a live product sends it back for review. What you see is what was approved.",
    },
    {
      icon: Truck,
      title: "Dispatched in days, not weeks",
      body: `Orders leave the warehouse within ${settings.dispatchDays} working ${
        settings.dispatchDays === 1 ? "day" : "days"
      }. Delivery is free above ${formatPaise(settings.freeShippingThresholdPaise)}.`,
    },
    {
      icon: Wallet,
      title: "Weavers paid on delivery",
      body: "A seller is settled only once your parcel has actually reached you, so nobody is paid for an order that never arrived.",
    },
    {
      icon: Headset,
      title: "Support that answers",
      body: settings.returnsEnabled
        ? `Raise a request from your account and follow it to resolution. Returns accepted within ${settings.returnWindowDays} days of delivery.`
        : "Raise a request from your account and follow it through to resolution, with every reply kept on one thread.",
    },
  ];

  return (
    <section className="border-t border-ivory-400">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="mb-10 flex flex-col items-center text-center">
          <p className="eyebrow mb-3">Why Saawariya</p>
          <h2 className="font-display text-3xl leading-tight sm:text-[2rem]">
            Bought with confidence
          </h2>
          <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-ink-400">
            Six things we do on every order, not six things we say.
          </p>
        </div>

        <ul className="grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {blocks.map(({ icon: Icon, title, body }) => (
            // min-w-0: a grid item will not shrink below its content's
            // min-content width, which is how a nowrap child gives the page
            // horizontal scroll at 375px.
            <li key={title} className="flex min-w-0 gap-4">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-gold-400 text-brand-700"
              >
                <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.5} />
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-lg leading-snug text-ink-900">
                  {title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
