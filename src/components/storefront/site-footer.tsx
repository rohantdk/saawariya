import Link from "next/link";
import { getCategoryTree, getPublishedCmsPages } from "@/lib/catalogue/queries";
import { Wordmark } from "@/components/brand/wordmark";

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
    <footer className="mt-auto border-t border-ivory-400 bg-brand-900 text-ivory-100">
      <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark tone="light" showMark={false} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ivory-100/70">
              Sarees, suits, lehengas and fabric by the metre, sourced directly
              from India&apos;s weaving clusters and sold by verified sellers.
            </p>
            <dl className="mt-6 space-y-1 text-sm text-ivory-100/70">
              <div className="flex gap-2">
                <dt className="sr-only">Email</dt>
                <dd>support@saawariya.example</dd>
              </div>
              <div className="flex gap-2">
                <dt className="sr-only">Phone</dt>
                <dd>+91 98100 00008</dd>
              </div>
            </dl>
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
            <FooterLink href="/wholesale" label="Wholesale & bulk" />
            <FooterLink href="/register" label="Create an account" />
          </FooterColumn>
        </div>
      </div>

      <div className="border-t border-ivory-100/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-xs text-ivory-100/50 sm:flex-row sm:items-center sm:justify-between lg:px-8">
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
      <h2 className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-gold-300">
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
        className="text-sm text-ivory-100/70 transition-colors hover:text-ivory-50"
      >
        {label}
      </Link>
    </li>
  );
}
