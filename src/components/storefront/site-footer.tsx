import Link from "next/link";
import { getCategoryTree, getPublishedCmsPages } from "@/lib/catalogue/queries";
import { Wordmark } from "@/components/brand/wordmark";

/** lucide-react ships no brand marks, so these three are drawn directly. */
function InstagramGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M15 8.5h-2a1.5 1.5 0 0 0-1.5 1.5v2h3.5l-.5 3H11.5v7h-3v-7H6.5v-3H8.5v-2.3C8.5 6.8 10 5 12.7 5H15v3.5Z" />
    </svg>
  );
}

function YoutubeGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="3" y="6" width="18" height="12" rx="3.5" />
      <path d="M10.5 9.5v5l4.5-2.5-4.5-2.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Decorative only — no social accounts exist for this build to link to,
// and a real-looking URL that goes nowhere is worse than an icon that is
// honestly not a link.
const SOCIAL_ICONS = [
  { label: "Instagram", icon: InstagramGlyph },
  { label: "Facebook", icon: FacebookGlyph },
  { label: "YouTube", icon: YoutubeGlyph },
];

/**
 * Storefront footer — SRS §153, §156.
 *
 * The policy columns are built from the CmsPage rows that are actually
 * published rather than from a hardcoded list, so the footer cannot come to
 * advertise a page that has been unpublished in the admin panel. Slugs are
 * grouped by intent; anything published but not named in a group still gets a
 * link, which is what stops a new CMS page from being unreachable.
 */

const SERVICE_SLUGS = ["shipping-policy", "return-policy", "faq", "contact-us"];
const COMPANY_SLUGS = ["about-us", "privacy-policy", "terms-and-conditions"];

export async function SiteFooter() {
  const [categories, pages] = await Promise.all([
    getCategoryTree(),
    getPublishedCmsPages(),
  ]);

  const byGroup = (slugs: string[]) =>
    slugs
      .map((slug) => pages.find((page) => page.slug === slug))
      .filter((page): page is (typeof pages)[number] => Boolean(page));

  const service = byGroup(SERVICE_SLUGS);
  const company = byGroup(COMPANY_SLUGS);
  const grouped = new Set([...SERVICE_SLUGS, ...COMPANY_SLUGS]);
  const ungrouped = pages.filter((page) => !grouped.has(page.slug));

  return (
    <footer className="mt-auto border-t border-ivory-400 bg-brand-900 text-cream">
      <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark surface="dark" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-cream/70">
              Sarees, suits, lehengas and fabric by the metre, sourced directly
              from India&apos;s weaving clusters and sold by verified sellers.
            </p>
            <dl className="mt-6 space-y-1 text-sm text-cream/70">
              <div className="flex gap-2">
                <dt className="sr-only">Email</dt>
                <dd>support@saawariya.example</dd>
              </div>
              <div className="flex gap-2">
                <dt className="sr-only">Phone</dt>
                <dd>+91 98100 00008</dd>
              </div>
            </dl>
            <ul className="mt-6 flex items-center gap-3">
              {SOCIAL_ICONS.map(({ label, icon: Icon }) => (
                <li key={label}>
                  <span
                    aria-label={label}
                    title={label}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-cream/20 text-cream/70"
                  >
                    <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <FooterColumn title="Shop">
            {categories.map((category) => (
              <FooterLink
                key={category.id}
                href={`/shop/${category.slug}`}
                label={category.name}
              />
            ))}
            <FooterLink href="/shop" label="All products" />
          </FooterColumn>

          <FooterColumn title="Customer service">
            {service.map((page) => (
              <FooterLink
                key={page.slug}
                href={`/page/${page.slug}`}
                label={page.title}
              />
            ))}
            {ungrouped.map((page) => (
              <FooterLink
                key={page.slug}
                href={`/page/${page.slug}`}
                label={page.title}
              />
            ))}
          </FooterColumn>

          <FooterColumn title="Company">
            {company.map((page) => (
              <FooterLink
                key={page.slug}
                href={`/page/${page.slug}`}
                label={page.title}
              />
            ))}
            <FooterLink href="/register" label="Create an account" />
          </FooterColumn>
        </div>
      </div>

      <div className="border-t border-cream/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-xs text-cream/50 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>© {new Date().getFullYear()} Saawariya Textiles Private Limited</p>
          <p>Prepared for Team ARJITAY</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-gold-300">
        {title}
      </h2>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-cream/70 transition-colors hover:text-cream"
      >
        {label}
      </Link>
    </li>
  );
}
