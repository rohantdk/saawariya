import Link from "next/link";
import { Heart, ShoppingBag, UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { getCustomerContext } from "@/lib/commerce/context";
import { getBagCounts } from "@/lib/commerce/cart";
import { getCategoryTree } from "@/lib/catalogue/queries";
import { getCommerceSettings } from "@/lib/commerce/settings";
import { Wordmark } from "@/components/brand/wordmark";
import { AnnouncementRibbon } from "@/components/storefront/announcement-ribbon";
import { HeaderShell } from "@/components/storefront/header-shell";
import { MegaMenu } from "@/components/storefront/mega-menu";
import { MobileNav } from "@/components/storefront/mobile-nav";
import { SearchBox } from "@/components/storefront/search-box";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ROLE_HOME, ROLE_LABEL } from "@/lib/constants";
import { cn, formatPaise } from "@/lib/utils";

/**
 * Storefront header — SRS §144, §145.
 *
 * Deep wine rather than ivory. The brand mark is cream artwork drawn for a
 * maroon field, and on an ivory bar it had to be recoloured to survive; against
 * wine it is simply itself. It also means the header and the hero's scrim meet
 * as one dark mass at the top of the homepage instead of as two stacked strips.
 *
 * Three tiers, which condense to two as soon as the page moves — see HeaderShell
 * for how the scrolled state is published:
 *   1. announcement + utility links, which collapse away on scroll
 *   2. the lockup, search and account actions, which tighten
 *   3. the category bar, which never leaves — it is the navigation
 *
 * The bag and wishlist icons only render for a signed-in customer. A cart row
 * belongs to a Customer record, so there is nowhere to keep an anonymous bag;
 * showing a permanently empty icon to a visitor, or one to a warehouse user who
 * cannot shop, would be chrome that does not mean anything.
 */

const UTILITY_LINKS = [
  { href: "/page/about-us", label: "Our story" },
  { href: "/page/faq", label: "Help" },
];

export async function SiteHeader() {
  const [categories, user, customer, settings] = await Promise.all([
    getCategoryTree(),
    getCurrentUser(),
    getCustomerContext(),
    getCommerceSettings(),
  ]);

  const counts = customer
    ? await getBagCounts(customer.customerId)
    : { cart: 0, wishlist: 0 };

  // Read from the settings the admin panel writes, so the strip cannot promise
  // terms that checkout does not actually apply.
  const announcements = [
    `Free shipping over ${formatPaise(settings.freeShippingThresholdPaise)}`,
    `Dispatched within ${settings.dispatchDays} working ${settings.dispatchDays === 1 ? "day" : "days"}`,
    "Handwoven, direct from the loom",
    ...(settings.returnsEnabled
      ? [`Returns accepted within ${settings.returnWindowDays} days of delivery`]
      : []),
  ];

  return (
    <HeaderShell>
      {/* ---- Tier 1: announcement + utility. Collapses on scroll. ---- */}
      <div
        className={cn(
          "overflow-hidden border-b border-cream/10 bg-brand-950",
          "h-9 transition-[height,opacity] duration-500 ease-[var(--ease-out-soft)]",
          // The border is dropped too, or the collapsed strip leaves a 1px rule
          // floating above the bar.
          "group-data-[scrolled=true]:h-0 group-data-[scrolled=true]:border-b-0",
          "group-data-[scrolled=true]:opacity-0",
        )}
      >
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-5 lg:px-8">
          <AnnouncementRibbon messages={announcements} />

          <nav aria-label="Secondary">
            <ul className="flex items-center gap-5">
              {UTILITY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    // The strip is 36px tall, so a 44px target will not fit —
                    // but the bare text was a 14px-high hit area, under the
                    // 24px WCAG 2.5.8 minimum as well. `inline-flex` plus the
                    // full strip height gives the link the whole bar to be
                    // tapped in, without changing how it looks.
                    className="inline-flex h-9 items-center text-[0.6875rem] uppercase tracking-[0.12em] text-cream/70 transition-colors hover:text-gold-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/* ---- Tier 2: lockup, search, actions ---- */}
      <div
        className={cn(
          // Phone budget, at 375px: 16+16 padding, 44 menu, 8+8 gaps, the
          // lockup, and an actions cluster that is 44+44+36 once the bag and
          // wishlist carry proper touch targets. Full-size gaps and padding do
          // not leave room for all of that, and the row is built from shrink-0
          // parts, so anything over budget becomes a sideways scroll rather
          // than a squeeze. Tighter below `sm`, unchanged above it.
          "mx-auto flex max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-5 lg:px-8",
          "h-[5.75rem] transition-[height] duration-500 ease-[var(--ease-out-soft)]",
          "group-data-[scrolled=true]:h-[4.5rem]",
        )}
      >
        <MobileNav categories={categories} utilityLinks={UTILITY_LINKS} />

        <Wordmark
          size={56}
          surface="dark"
          // Below 360px the arch alone carries the brand. Keeping the type as
          // well put the row over the viewport again once the bag, wishlist and
          // theme controls became real 44px targets.
          typeClassName="hidden min-[360px]:block"
          className={cn(
            "shrink-0 origin-left",
            // The lockup is 224px at its full size. With the menu button, the
            // gaps, the page padding and the signed-in actions cluster, that
            // totalled 401px in a 375px viewport — and since both this and the
            // actions are shrink-0, nothing could give and /cart and /checkout
            // scrolled sideways. Smaller below `sm`, full size from there.
            "[--lockup-h:2rem] sm:[--lockup-h:3.5rem]",
            // Scaling rather than re-rendering at a smaller size: a transform
            // animates on the compositor, where swapping the image height would
            // relayout the bar on every frame.
            "transition-transform duration-500 ease-[var(--ease-out-soft)]",
            "group-data-[scrolled=true]:scale-[0.82]",
          )}
        />

        <SearchBox
          surface="dark"
          className="mx-auto hidden w-full max-w-md md:block"
        />

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3 md:ml-0">
          <ThemeToggle />

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
              // The name alongside is hidden below `lg`, so the link is only as
              // big as the 36px avatar. A minimum height gives it a full target
              // without resizing the avatar itself.
              className="group/user flex h-11 items-center gap-2.5"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-400/40 bg-brand-600 text-[0.6875rem] font-semibold text-cream transition-colors group-hover/user:border-gold-400"
              >
                {initialsOf(user.fullName)}
              </span>
              <span className="hidden text-left leading-tight lg:block">
                <span className="block text-xs text-cream transition-colors group-hover/user:text-gold-300">
                  {user.fullName.split(" ")[0]}
                </span>
                <span className="block text-[0.625rem] uppercase tracking-[0.1em] text-cream/55">
                  {ROLE_LABEL[user.role]}
                </span>
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              // Below `sm` the label is hidden and only the 16px icon is left,
              // which was a 16x16 target. The minimum size gives it a real one;
              // from `sm` the label returns and the box grows past it anyway.
              className="flex h-11 min-w-11 items-center justify-center gap-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-cream/85 transition-colors hover:text-gold-300 sm:justify-start"
            >
              <UserRound aria-hidden="true" className="h-4 w-4" />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
          )}
        </div>
      </div>

      {/* ---- Tier 3: categories ---- */}
      <div className="hidden border-t border-cream/10 lg:block">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <MegaMenu categories={categories} />
        </div>
      </div>

      {/* Search moves below the lockup on small screens rather than being
          hidden behind the drawer. */}
      <div className="border-t border-cream/10 px-5 py-3 md:hidden">
        <SearchBox surface="dark" id="site-search-mobile" />
      </div>
    </HeaderShell>
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
        // 44x44. The bag and wishlist are the two controls a shopper reaches
        // for most on a phone, and `p-1` around an 18px icon left them at 26px.
        // Only the hit area grows — the icon and the count badge are unchanged.
        "relative inline-flex h-11 w-11 shrink-0 items-center justify-center text-cream/85 transition-colors hover:text-gold-300",
        className,
      )}
    >
      {children}
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-400 px-1 text-[0.625rem] font-semibold leading-none text-brand-950"
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
