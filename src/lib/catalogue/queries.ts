import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  COLOUR_FAMILIES,
  PRICE_BANDS,
  PRODUCT_STATUS,
  REVIEW_PUBLIC_STATUS,
  SELLER_VERIFICATION,
} from "@/lib/constants";
import {
  AVAILABILITY_OPTIONS,
  FACET_GROUPS,
  PAGE_SIZE,
  type CatalogueFilters,
  type MultiKey,
  type SortSlug,
} from "@/lib/catalogue/filters";

/**
 * Every read the public storefront makes.
 *
 * The single most important thing in this file is PUBLIC_PRODUCT_WHERE. Seven
 * of the 41 seeded products are draft, pending or rejected and exist so the
 * admin and seller queues have real work in them — none of them may ever appear
 * on the storefront. That rule is expressed once, here, and spread into every
 * query below, rather than being a `where` clause each page is trusted to
 * remember. A page that forgets it is a catalogue leak, and the failure is
 * silent.
 */

// ---------------------------------------------------------------------------
// VISIBILITY
// ---------------------------------------------------------------------------

/**
 * What "publicly visible" means for a product.
 *
 * Approved product AND approved seller. The seller half is currently redundant
 * — every approved product happens to belong to an approved seller — but it is
 * the rule the marketplace actually needs: suspending a seller must remove
 * their catalogue from the storefront without touching 13 product rows.
 */
export const PUBLIC_PRODUCT_WHERE = {
  status: PRODUCT_STATUS.APPROVED,
  seller: { verificationStatus: SELLER_VERIFICATION.APPROVED },
} satisfies Prisma.ProductWhereInput;

/** Reviews are moderated (SRS §47); only approved ones are public. */
export const PUBLIC_REVIEW_WHERE = {
  status: REVIEW_PUBLIC_STATUS,
} satisfies Prisma.ReviewWhereInput;

// ---------------------------------------------------------------------------
// SHAPES
// ---------------------------------------------------------------------------

/**
 * Exactly what a product card renders — nothing more. Product.description is a
 * long paragraph per row and would otherwise be serialised into the RSC payload
 * 12 times per listing page for no reason.
 */
export const PRODUCT_CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  fabric: true,
  collection: true,
  priceRetail: true,
  priceOffer: true,
  priceWholesale: true,
  priceEffective: true,
  minOrderQty: true,
  ratingAvg: true,
  ratingCount: true,
  isNewArrival: true,
  seller: { select: { businessName: true, city: true, state: true } },
  category: { select: { name: true, slug: true, parent: { select: { slug: true } } } },
  images: {
    where: { isMain: true },
    take: 1,
    select: { url: true, alt: true },
  },
  inventory: { select: { status: true, stockQty: true } },
} satisfies Prisma.ProductSelect;

export type ProductCard = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_CARD_SELECT;
}>;

// ---------------------------------------------------------------------------
// CATEGORIES
// ---------------------------------------------------------------------------

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  iconName: string | null;
  children: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
  }>;
};

/**
 * The whole two-level tree, for the mega-menu and the homepage grid.
 * `cache()` means the header, the footer and the page body share one query.
 */
export const getCategoryTree = cache(async (): Promise<CategoryNode[]> => {
  const parents = await prisma.category.findMany({
    where: { parentId: null, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      iconName: true,
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          imageUrl: true,
        },
      },
    },
  });

  return parents;
});

export const getCategoryBySlug = cache(async (slug: string) => {
  return prisma.category.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      parent: { select: { id: true, name: true, slug: true } },
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true, imageUrl: true },
      },
    },
  });
});

/** A category scope covers the category itself plus its children. */
function categoryScope(categoryIds: string[]): Prisma.ProductWhereInput {
  return { categoryId: { in: categoryIds } };
}

// ---------------------------------------------------------------------------
// FILTER → WHERE
// ---------------------------------------------------------------------------

/**
 * Which filters translate to which `where` fragments.
 *
 * Split out per key so that facet counting can rebuild the clause while
 * *omitting* one facet — the standard rule that a facet group must not narrow
 * its own counts, or every option except the selected one reads zero.
 */
function clauseFor(
  key: MultiKey,
  filters: CatalogueFilters,
): Prisma.ProductWhereInput | null {
  const values = filters[key];
  if (values.length === 0) return null;

  switch (key) {
    case "fabric":
      return { fabric: { in: values } };
    case "pattern":
      return { pattern: { in: values } };
    case "occasion":
      return { occasion: { in: values } };
    case "workType":
      return { workType: { in: values } };

    case "colour": {
      // Free-text colour matched by family substring — see COLOUR_FAMILIES.
      const terms = values.flatMap(
        (slug) => COLOUR_FAMILIES.find((c) => c.slug === slug)?.terms ?? [],
      );
      return { OR: terms.map((term) => ({ color: { contains: term } })) };
    }

    case "price": {
      const bands = values
        .map((slug) => PRICE_BANDS.find((b) => b.slug === slug))
        .filter((b): b is (typeof PRICE_BANDS)[number] => Boolean(b));
      return {
        OR: bands.map((band) => ({
          priceEffective:
            band.max === null
              ? { gte: band.min }
              : { gte: band.min, lt: band.max },
        })),
      };
    }

    case "availability":
      return { inventory: { status: { in: values } } };
  }
}

/** Free-text search — SRS §160. Name, fabric, collection and seller name. */
function searchClause(q: string | null): Prisma.ProductWhereInput | null {
  if (!q) return null;
  return {
    OR: [
      { name: { contains: q } },
      { fabric: { contains: q } },
      { collection: { contains: q } },
      { seller: { businessName: { contains: q } } },
    ],
  };
}

type Scope = {
  /** Restrict to these category ids (a category page). */
  categoryIds?: string[];
  /** Restrict to one seller. */
  sellerId?: string;
};

function buildWhere(
  filters: CatalogueFilters,
  scope: Scope,
  omitFacet?: MultiKey,
): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [PUBLIC_PRODUCT_WHERE];

  if (scope.categoryIds?.length) and.push(categoryScope(scope.categoryIds));
  if (scope.sellerId) and.push({ sellerId: scope.sellerId });
  if (filters.collection) and.push({ collection: filters.collection });

  const search = searchClause(filters.q);
  if (search) and.push(search);

  for (const key of [
    "fabric",
    "pattern",
    "occasion",
    "workType",
    "colour",
    "price",
    "availability",
  ] as const) {
    if (key === omitFacet) continue;
    const clause = clauseFor(key, filters);
    if (clause) and.push(clause);
  }

  return { AND: and };
}

const ORDER_BY: Record<SortSlug, Prisma.ProductOrderByWithRelationInput[]> = {
  // `priceEffective` rather than `priceRetail`: 11 products carry an offer
  // price, and sorting by the pre-discount figure puts them in the wrong place.
  // It is the RETAIL effective price even for trade accounts, deliberately —
  // catalogue order should not rearrange itself depending on who is signed in.
  featured: [{ isFeatured: "desc" }, { salesCount: "desc" }],
  newest: [{ createdAt: "desc" }],
  "price-asc": [{ priceEffective: "asc" }],
  "price-desc": [{ priceEffective: "desc" }],
  rating: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
  popular: [{ salesCount: "desc" }],
};

// ---------------------------------------------------------------------------
// LISTING
// ---------------------------------------------------------------------------

export type ProductListing = {
  items: ProductCard[];
  total: number;
  page: number;
  pageCount: number;
};

export async function listProducts(
  filters: CatalogueFilters,
  scope: Scope = {},
): Promise<ProductListing> {
  const where = buildWhere(filters, scope);

  const total = await prisma.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Clamp rather than 404: ?page=99 on a two-page listing should show the last
  // page, not an error.
  const page = Math.min(filters.page, pageCount);

  const items = await prisma.product.findMany({
    where,
    select: PRODUCT_CARD_SELECT,
    // `id` last as a stable tiebreaker — without it, two products with equal
    // salesCount can swap between pages and a row is skipped or repeated.
    orderBy: [...ORDER_BY[filters.sort], { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return { items, total, page, pageCount };
}

// ---------------------------------------------------------------------------
// FACET COUNTS
// ---------------------------------------------------------------------------

export type FacetCounts = Record<MultiKey, Record<string, number>>;

/**
 * Counts shown beside each filter option.
 *
 * Correct faceting means each group is counted with every *other* group's
 * filters applied but not its own, so ticking "Cotton" does not make every
 * other fabric read zero. Doing that with seven `groupBy` round trips would be
 * seven queries; instead this pulls one narrow projection of the matching rows
 * and counts in memory.
 *
 * That is a deliberate trade. It is right for a catalogue of this size — the
 * projection is six short columns — and it stays right into the low thousands.
 * A catalogue large enough for it to hurt wants a search index (Meilisearch,
 * Typesense) rather than seven more SQL queries, and this function is the one
 * place that would change.
 */
export async function getFacetCounts(
  filters: CatalogueFilters,
  scope: Scope = {},
): Promise<FacetCounts> {
  const keys: MultiKey[] = [
    "fabric",
    "pattern",
    "occasion",
    "workType",
    "colour",
    "price",
    "availability",
  ];

  const empty = () => Object.fromEntries(keys.map((k) => [k, {}])) as FacetCounts;
  const counts = empty();

  await Promise.all(
    keys.map(async (key) => {
      const rows = await prisma.product.findMany({
        where: buildWhere(filters, scope, key),
        select: {
          fabric: true,
          pattern: true,
          occasion: true,
          workType: true,
          color: true,
          priceEffective: true,
          inventory: { select: { status: true } },
        },
      });

      const bucket: Record<string, number> = {};
      const bump = (value: string) => {
        bucket[value] = (bucket[value] ?? 0) + 1;
      };

      for (const row of rows) {
        switch (key) {
          case "fabric":
          case "pattern":
          case "occasion":
          case "workType": {
            const value = row[key];
            if (value) bump(value);
            break;
          }
          case "colour": {
            for (const family of COLOUR_FAMILIES) {
              if (family.terms.some((t) => row.color?.includes(t))) {
                bump(family.slug);
              }
            }
            break;
          }
          case "price": {
            const band = PRICE_BANDS.find(
              (b) =>
                row.priceEffective >= b.min &&
                (b.max === null || row.priceEffective < b.max),
            );
            if (band) bump(band.slug);
            break;
          }
          case "availability": {
            const status = row.inventory?.status;
            if (status && AVAILABILITY_OPTIONS.some((a) => a.slug === status)) {
              bump(status);
            }
            break;
          }
        }
      }

      counts[key] = bucket;
    }),
  );

  return counts;
}

/** The facet groups that have at least one option in the current scope. */
export function visibleFacetGroups(counts: FacetCounts) {
  return FACET_GROUPS.filter((group) =>
    group.values.some((value) => (counts[group.key][value] ?? 0) > 0),
  );
}

// ---------------------------------------------------------------------------
// HOMEPAGE
// ---------------------------------------------------------------------------

export async function getFeaturedProducts(take = 8): Promise<ProductCard[]> {
  return prisma.product.findMany({
    where: { ...PUBLIC_PRODUCT_WHERE, isFeatured: true },
    select: PRODUCT_CARD_SELECT,
    orderBy: [{ salesCount: "desc" }, { id: "asc" }],
    take,
  });
}

export async function getNewArrivals(take = 8): Promise<ProductCard[]> {
  return prisma.product.findMany({
    where: { ...PUBLIC_PRODUCT_WHERE, isNewArrival: true },
    select: PRODUCT_CARD_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take,
  });
}

/**
 * Best sellers — SRS §151.
 *
 * Ordered by `Product.salesCount`, which `recomputeProductSales` derives from
 * the order lines that actually reached a customer. That is the **same column**
 * the listing page's "Best selling" sort uses, deliberately: this rail links
 * straight to `/shop?sort=popular`, and a homepage that ranked best sellers one
 * way while the page behind its own link ranked them another would be two
 * answers to one question.
 *
 * A product with no deliveries scores zero and is excluded, so the rail is
 * empty on a platform that has not sold anything rather than padded with
 * whatever happens to sort first.
 */
export async function getBestSellers(take = 8): Promise<ProductCard[]> {
  return prisma.product.findMany({
    where: { ...PUBLIC_PRODUCT_WHERE, salesCount: { gt: 0 } },
    select: PRODUCT_CARD_SELECT,
    orderBy: [{ salesCount: "desc" }, { ratingAvg: "desc" }, { id: "asc" }],
    take,
  });
}

export type Testimonial = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  productName: string;
  productSlug: string;
};

/**
 * Customer testimonials — SRS §154.
 *
 * These are **real approved reviews**, not marketing copy: the same rows the
 * product pages show and the same rows an admin moderated. Writing quotes and
 * attributing them to invented customers would put fake praise from fake people
 * on the front page of a demo, which is the one thing this build has refused to
 * do anywhere else.
 *
 * SRS §154 also asks for a profile image. There are none — the platform has
 * never collected an avatar, and dressing stock photographs of real people up
 * as customers would be worse than the gap. The card shows a monogram instead.
 */
export async function getTestimonials(take = 3): Promise<Testimonial[]> {
  const reviews = await prisma.review.findMany({
    where: {
      status: REVIEW_PUBLIC_STATUS,
      rating: { gte: 4 },
      // A testimonial needs something to say; the shortest approved reviews are
      // a line long and read as filler beside the others.
      body: { not: "" },
      product: PUBLIC_PRODUCT_WHERE,
    },
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      user: { select: { fullName: true } },
      product: { select: { name: true, slug: true } },
    },
    orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
    // A generous pool, because the two filters below are lossy: the highest
    // rated reviews are also the ones whose wording repeats most across the
    // catalogue, so a pool of `take * 4` ran out of distinct quotes and the
    // band rendered two cards where it asked for three.
    take: 60,
  });

  // The catalogue reuses review wording across products, so without this the
  // band can show one quote twice under two different names — which is exactly
  // what makes a testimonials section read as invented, and the reason these
  // are real reviews in the first place.
  const seenWording = new Set<string>();

  return reviews
    .filter((r) => {
      if (r.body.length < 80) return false;
      const key = r.body.trim().toLowerCase();
      if (seenWording.has(key)) return false;
      seenWording.add(key);
      return true;
    })
    .slice(0, take)
    .map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      authorName: r.user.fullName,
      productName: r.product.name,
      productSlug: r.product.slug,
    }));
}

export async function getBanners(position: string) {
  const now = new Date();
  return prisma.banner.findMany({
    where: {
      position,
      isActive: true,
      // A scheduled banner must not appear before it starts or after it ends.
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      subtitle: true,
      imageUrl: true,
      linkUrl: true,
    },
  });
}

/** Product counts per top-level category, for the homepage grid. */
export async function getCategoryProductCounts(): Promise<Map<string, number>> {
  const rows = await prisma.product.findMany({
    where: PUBLIC_PRODUCT_WHERE,
    select: { category: { select: { slug: true, parent: { select: { slug: true } } } } },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    const sub = row.category.slug;
    const top = row.category.parent?.slug ?? sub;
    counts.set(sub, (counts.get(sub) ?? 0) + 1);
    if (top !== sub) counts.set(top, (counts.get(top) ?? 0) + 1);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// PRODUCT DETAIL
// ---------------------------------------------------------------------------

export const getProductBySlug = cache(async (slug: string) => {
  return prisma.product.findFirst({
    where: { slug, ...PUBLIC_PRODUCT_WHERE },
    select: {
      id: true,
      sku: true,
      name: true,
      slug: true,
      description: true,
      brand: true,
      collection: true,
      fabric: true,
      pattern: true,
      occasion: true,
      workType: true,
      color: true,
      weightGrams: true,
      priceRetail: true,
      priceOffer: true,
      priceWholesale: true,
      priceEffective: true,
      minOrderQty: true,
      maxOrderQty: true,
      ratingAvg: true,
      ratingCount: true,
      salesCount: true,
      isNewArrival: true,
      createdAt: true,
      categoryId: true,
      seller: {
        select: {
          id: true,
          businessName: true,
          ownerName: true,
          businessType: true,
          description: true,
          city: true,
          state: true,
          verificationStatus: true,
          verifiedAt: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          parent: { select: { name: true, slug: true } },
        },
      },
      images: {
        orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
        select: { id: true, url: true, alt: true },
      },
      variants: {
        orderBy: { sku: "asc" },
        select: {
          id: true,
          name: true,
          value: true,
          sku: true,
          priceDeltaPaise: true,
          stockQty: true,
        },
      },
      inventory: {
        select: {
          status: true,
          stockQty: true,
          // The buy panel subtracts reservations, so what it offers matches
          // what the cart will actually accept.
          reservedQty: true,
          lowStockThreshold: true,
        },
      },
    },
  });
});

export type ProductDetail = NonNullable<
  Awaited<ReturnType<typeof getProductBySlug>>
>;

export type RatingBreakdown = {
  /** Index 0 is one star, index 4 is five stars. */
  buckets: { stars: number; count: number; percent: number }[];
  total: number;
  average: number;
};

export async function getProductReviews(productId: string) {
  const [reviews, grouped] = await Promise.all([
    prisma.review.findMany({
      where: { productId, ...PUBLIC_REVIEW_WHERE },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        createdAt: true,
        user: { select: { fullName: true } },
      },
    }),
    prisma.review.groupBy({
      by: ["rating"],
      where: { productId, ...PUBLIC_REVIEW_WHERE },
      _count: { rating: true },
    }),
  ]);

  const byRating = new Map(grouped.map((g) => [g.rating, g._count.rating]));
  const total = grouped.reduce((sum, g) => sum + g._count.rating, 0);
  const weighted = grouped.reduce((sum, g) => sum + g.rating * g._count.rating, 0);

  const breakdown: RatingBreakdown = {
    buckets: [5, 4, 3, 2, 1].map((stars) => {
      const count = byRating.get(stars) ?? 0;
      return {
        stars,
        count,
        percent: total === 0 ? 0 : Math.round((count / total) * 100),
      };
    }),
    total,
    // Recomputed from the public reviews rather than read off Product.ratingAvg,
    // which includes ratings still awaiting moderation.
    average: total === 0 ? 0 : Math.round((weighted / total) * 10) / 10,
  };

  return { reviews, breakdown };
}

/**
 * Related products: same sub-category first, then anything else from the same
 * seller, so the rail is never short on a thinly stocked leaf category.
 */
export async function getRelatedProducts(
  product: { id: string; categoryId: string; seller: { id: string } },
  take = 4,
): Promise<ProductCard[]> {
  const sameCategory = await prisma.product.findMany({
    where: {
      ...PUBLIC_PRODUCT_WHERE,
      categoryId: product.categoryId,
      id: { not: product.id },
    },
    select: PRODUCT_CARD_SELECT,
    orderBy: [{ ratingAvg: "desc" }, { id: "asc" }],
    take,
  });

  if (sameCategory.length >= take) return sameCategory;

  const seen = new Set([product.id, ...sameCategory.map((p) => p.id)]);
  const fromSeller = await prisma.product.findMany({
    where: {
      ...PUBLIC_PRODUCT_WHERE,
      sellerId: product.seller.id,
      id: { notIn: [...seen] },
    },
    select: PRODUCT_CARD_SELECT,
    orderBy: [{ salesCount: "desc" }, { id: "asc" }],
    take: take - sameCategory.length,
  });

  return [...sameCategory, ...fromSeller];
}

// ---------------------------------------------------------------------------
// CMS
// ---------------------------------------------------------------------------

export const getCmsPage = cache(async (slug: string) => {
  return prisma.cmsPage.findFirst({
    where: { slug, isPublished: true },
    select: {
      slug: true,
      title: true,
      bodyHtml: true,
      metaTitle: true,
      metaDescription: true,
      updatedAt: true,
    },
  });
});

export const getPublishedCmsPages = cache(async () => {
  return prisma.cmsPage.findMany({
    where: { isPublished: true },
    orderBy: { title: "asc" },
    select: { slug: true, title: true },
  });
});

/** Verified sellers, for the wholesale page's supplier proof. */
export async function getApprovedSellers() {
  return prisma.seller.findMany({
    where: {
      verificationStatus: SELLER_VERIFICATION.APPROVED,
      products: { some: PUBLIC_PRODUCT_WHERE },
    },
    orderBy: { businessName: "asc" },
    select: {
      id: true,
      businessName: true,
      businessType: true,
      description: true,
      city: true,
      state: true,
      _count: { select: { products: { where: PUBLIC_PRODUCT_WHERE } } },
    },
  });
}
