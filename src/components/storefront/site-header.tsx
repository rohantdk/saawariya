import Link from "next/link";
import { Heart, ShoppingBag, UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { getCustomerContext } from "@/lib/commerce/context";
import { getBagCounts } from "@/lib/commerce/cart";
import { getCategoryTree } from "@/lib/catalogue/queries";
import { Wordmark } from "@/components/brand/wordmark";
import { MegaMenu } from "@/components/storefront/mega-menu";
import { MobileNav } from "@/components/storefront/mobile-nav";
import { SearchBox } from "@/components/storefront/search-box";
import { ROLE_HOME, ROLE_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Storefront header — SRS §144, §145.
 *
 * The bag and wishlist icons only render for a signed-in customer. A cart row
 * belongs to a Customer record, so there is nowhere to keep an anonymous bag;
 * showing a permanently empty icon to a visitor, or one to a warehouse user who
 * cannot shop, would be chrome that does not mean anything.
 */

const UTILITY_LINKS = [
  { href: "/wholesale", label: "Wholesale" },
  { href: "/page/about-us", label: "Our story" },
  { href: "/page/faq", label: "Help" },
];

export async function SiteHeader() {
  const [categories, user, customer] = await Promise.all([
    getCategoryTree(),
    getCurrentUser(),
    getCustomerContext(),
  ]);

  const counts = customer
    ? await getBagCounts(customer.customerId)
    : { cart: 0, wishlist: 0 };

  return (
    <header className="sticky top-0 z-40 bg-ivory-50">
      {/* Utility bar */}
      <div className="bg-brand-900 text-ivory-100">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-5 lg:px-8">
          <p className="text-[0.6875rem] tracking-[0.08em] text-ivory-100/80">
            Handwoven, direct from the loom
          </p>
          <nav aria-label="Secondary">
            <ul className="flex items-center gap-5">
              {UTILITY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[0.6875rem] uppercase tracking-[0.12em] text-ivory-100/80 transition-colors hover:text-ivory-50"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/* Main bar */}
      <div className="border-b border-ivory-400 bg-ivory-50">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-4 px-5 lg:px-8">
          <MobileNav categories={categories} utilityLinks={UTILITY_LINKS} />

          <Wordmark className="shrink-0" />

          <SearchBox className="mx-auto hidden w-full max-w-md md:block" />

          <div className="ml-auto flex shrink-0 items-center gap-3 md:ml-0">
            {customer && (
              <>
                <BagLink
                  href="/account/wishlist"
                  label="Wishlist"
                  count={counts.wishlist}
                  className="hidden sm:inline-flex"
                >
                  <Heart aria-hidden="true" className="h-[1.15rem] w-[1.15rem]" />
                </BagLink>

                <BagLink href="/cart" label="Bag" count={counts.cart}>
                  <ShoppingBag
                    aria-hidden="true"
                    className="h-[1.15rem] w-[1.15rem]"
                  />
                </BagLink>
              </>
            )}

            {user ? (
              <Link
                href={ROLE_HOME[user.role] ?? "/account"}
                className="group flex items-center gap-2.5"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-[0.6875rem] font-medium text-ivory-50"
                >
                  {initialsOf(user.fullName)}
                </span>
                <span className="hidden text-left leading-tight lg:block">
                  <span className="block text-xs text-ink-900 group-hover:text-brand-600">
                    {user.fullName.split(" ")[0]}
                  </span>
                  <span className="block text-[0.625rem] uppercase tracking-[0.1em] text-ink-400">
                    {ROLE_LABEL[user.role]}
                  </span>
                </span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-900 transition-colors hover:text-brand-600"
              >
                <UserRound aria-hidden="true" className="h-4 w-4" />
                <span className="hidden sm:inline">Sign in</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Category bar */}
      <div className="hidden border-b border-ivory-400 bg-ivory-50 lg:block">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <MegaMenu categories={categories} />
        </div>
      </div>

      {/* Search moves below the wordmark on small screens rather than being
          hidden behind the drawer. */}
      <div className="border-b border-ivory-400 bg-ivory-50 px-5 py-3 md:hidden">
        <SearchBox />
      </div>
    </header>
  );
}

/**
 * An icon with a count. The count is in the accessible name rather than only in
 * the badge, so a screen reader announces "Bag, 3 items" instead of "Bag 3"
 * read as two unrelated things.
 */
function BagLink({
  href,
  label,
  count,
  className,
  children,
}: {
  href: string;
  label: string;
  count: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={
        count === 0
          ? `${label}, empty`
          : `${label}, ${count} item${count === 1 ? "" : "s"}`
      }
      className={cn(
        "relative inline-flex items-center justify-center p-1 text-ink-900 transition-colors hover:text-brand-600",
        className,
      )}
    >
      {children}
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[0.625rem] font-medium leading-none text-ivory-50"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

function initialsOf(fullName: string): string {
  return fullName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
