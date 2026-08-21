import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

/**
 * The craft band — the one editorial break in a page that is otherwise product
 * rails, placed between the merchandising above it and the proof points below.
 *
 * Every claim here is one the platform actually enforces elsewhere in the
 * codebase, not brand copy: listings carry their cluster because the seller
 * record stores it and the product card prints it, and sellers are settled after
 * delivery because the settlement job keys off the delivered transition. If any
 * of that changes, this copy is wrong and has to change with it.
 */
export function CraftBand() {
  return (
    <section className="relative overflow-hidden border-t border-ivory-400 bg-brand-950">
      {/* A faint zari wash across the top edge, so the band does not read as a
          flat rectangle of colour dropped into the page. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent"
      />

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:gap-20 lg:px-8 lg:py-24">
        <div className="relative">
          <div className="relative aspect-[4/3] overflow-hidden">
            <Image
              src="/editorial/handloom-craft.jpg"
              alt="A weaver drawing a gold zari weft through the warp on a pit loom."
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
          </div>

          {/* Overlapping inset. Hidden below lg, where it would cover the frame
              behind it rather than sit beside it. */}
          <div className="absolute -bottom-10 -right-6 hidden w-44 overflow-hidden border-4 border-brand-950 shadow-lifted xl:block">
            <div className="relative aspect-[3/4]">
              {/* A weaver rather than the cloth: this band's headline is
                  "Nothing here is anonymous" and every fact under it names a
                  person, so the inset should show one. */}
              <Image
                src="/editorial/weaver-woman.jpg"
                alt="A weaver at her loom, passing the shuttle through the warp."
                fill
                sizes="11rem"
                className="object-cover"
              />
            </div>
          </div>
        </div>

        <div>
          <p className="mb-5 inline-flex items-center gap-3 text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-gold-300">
            <span aria-hidden="true" className="h-px w-8 bg-gold-400" />
            The Craft
          </p>

          <h2 className="font-display text-3xl font-bold leading-[1.1] tracking-[-0.03em] text-cream sm:text-4xl lg:text-[2.75rem]">
            Nothing here is anonymous
          </h2>

          <p className="mt-6 max-w-lg text-sm leading-relaxed text-cream/70 sm:text-base">
            Every listing names the cluster it was woven in and the seller who
            wove it — Varanasi, Kanchipuram, Chanderi, Bagru. Not a house label
            over an unnamed supply chain.
          </p>

          <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-7 border-t border-cream/10 pt-8 sm:grid-cols-3">
            <CraftFact term="Named at source" detail="Cluster and seller on every product page" />
            <CraftFact term="Approved before listing" detail="And re-reviewed after any edit" />
            <CraftFact term="Paid on delivery" detail="Weavers settled once your parcel arrives" />
          </dl>

          <Link
            href="/shop"
            className="group/link mt-10 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-gold-300 transition-colors hover:text-gold-400"
          >
            Shop the catalogue
            <ArrowRight
              aria-hidden="true"
              className="h-3.5 w-3.5 transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover/link:translate-x-1"
            />
          </Link>
        </div>
      </div>
    </section>
  );
}

function CraftFact({ term, detail }: { term: string; detail: string }) {
  return (
    <div>
      <dt className="font-display text-base font-bold leading-snug text-cream">
        {term}
      </dt>
      <dd className="mt-1.5 text-xs leading-relaxed text-cream/55">
        {detail}
      </dd>
    </div>
  );
}
