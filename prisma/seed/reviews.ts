import type { PrismaClient } from "../../src/generated/prisma/client";

/**
 * Product reviews, plus the rating rollup written back onto Product.
 *
 * **Every review here is a verified purchase**, and that is the rule this module
 * is built around. `submitReview` will only accept a review for a product that
 * appears on a DELIVERED sub-order belonging to that customer — it checks the
 * order tables, not the form — `/account/reviews` builds its "write a review"
 * list the same way, and the homepage testimonials band tells visitors the
 * quotes come from verified purchases.
 *
 * This seed used to ignore all of that: it walked the catalogue and attached
 * reviews by `salesCount`, so 14 of 18 rows were written by customers who had
 * never received the product. Rows the application itself would have refused,
 * behind a claim on the homepage that could not be supported. It now starts from
 * the delivered order lines and reviews those, which is why `prisma/seed/orders.ts`
 * carries a block of historical delivered orders: the purchases have to exist
 * before the opinions can.
 *
 * Product.ratingAvg / ratingCount are denormalised counters — the listing and
 * search screens sort on them and must not aggregate Review on every request.
 * They are therefore recomputed here from the rows actually inserted, rather
 * than hardcoded, so the stars a reviewer sees always match the reviews they
 * can open. Only APPROVED reviews count toward the average (SRS §47).
 */

type ReviewTemplate = {
  rating: number;
  title: string;
  body: string;
};

/**
 * Written against textile qualities rather than a specific product, so they
 * stay coherent wherever they land. Ordering matters: the distribution below
 * walks this list, and it is deliberately weighted toward 4-5 stars with a
 * genuine minority of critical reviews — an all-5-star catalogue reads as fake.
 */
const REVIEW_POOL: ReviewTemplate[] = [
  {
    rating: 5,
    title: "The zari is the real thing",
    body: "I have bought enough sarees to know tested zari from the coated kind, and this is the real thing — it has weight and it does not scratch. The pallu is even denser than the photographs suggest.",
  },
  {
    rating: 5,
    title: "Exactly as photographed",
    body: "The colour matched the listing almost exactly, which almost never happens. Draped beautifully at my sister's wedding and I was asked about it all evening.",
  },
  {
    rating: 4,
    title: "Beautiful weave, slightly heavier than expected",
    body: "Lovely piece and the finish is excellent. Only note is that it is heavier than I expected from the description — fine for an evening function, a lot for a full day.",
  },
  {
    rating: 5,
    title: "Worth every rupee",
    body: "Took a chance on the price and it paid off. The border work is neat on both faces, which is how you tell a proper handloom from a power-loom copy.",
  },
  {
    rating: 4,
    title: "Good quality, delivery took a while",
    body: "No complaints about the product at all — soft, well finished, true to colour. It did take nine days to arrive, a little longer than the estimate shown at checkout.",
  },
  {
    rating: 5,
    title: "Beautiful drape",
    body: "Falls perfectly without needing starch. The blouse piece is generous and my tailor had no trouble with it.",
  },
  {
    rating: 3,
    title: "Nice fabric, colour slightly off",
    body: "The weave and finish are good, but the shade is noticeably deeper than it appears on screen. Not wrong exactly, just not what I had pictured. Keeping it, but worth knowing.",
  },
  {
    rating: 5,
    title: "Repeat purchase",
    body: "Second order from this seller. Consistent quality both times, and the packing is careful — cloth bag inside the carton rather than loose plastic.",
  },
  {
    rating: 4,
    title: "Lovely for the price",
    body: "For what it costs this is very good. It is not a heirloom piece and does not pretend to be, but the print is crisp and the cotton is genuinely soft.",
  },
  {
    rating: 5,
    title: "Natural dye, exactly as described",
    body: "You can smell that these are real vegetable dyes. There is slight variation across the length, which is what you want from block printing — a perfectly uniform print would mean it was screen printed.",
  },
  {
    rating: 4,
    title: "Sheer and light, as Chanderi should be",
    body: "Properly transparent and feather-light. Needs a good petticoat underneath, which is true of any real Chanderi.",
  },
  {
    rating: 2,
    title: "Loose thread at the border",
    body: "The saree itself is nice but there was a pulled thread along about four inches of the border. Support arranged a replacement without arguing, so the service was good, but the QC clearly missed it.",
  },
  {
    rating: 5,
    title: "Bought for my mother",
    body: "Gifted this for her sixtieth and she has already worn it twice. The colour suits older skin tones without being dull.",
  },
  {
    rating: 4,
    title: "Good bulk order experience",
    body: "Ordered forty metres for a boutique run. Shade consistency across the lot was better than I usually get, and the wholesale pricing is fair. Would order again.",
  },
  {
    rating: 5,
    title: "Superb finish",
    body: "The interlocked border is done properly — you can see the join on the reverse where it should be. Very pleased.",
  },
  {
    rating: 3,
    title: "Runs slightly small",
    body: "Fabric and stitching are good, but the fit is closer than the size chart suggests. Order one size up if you are between sizes.",
  },
  {
    rating: 5,
    title: "Arrived well before the estimate",
    body: "Ordered on a Monday, had it by Wednesday. Packaging was neat and the invoice was inside as it should be.",
  },
  {
    rating: 4,
    title: "Soft after the first wash",
    body: "Slightly stiff out of the packet, as handloom cotton usually is. One cold wash and it softened right up.",
  },
  {
    rating: 5,
    title: "The reverse is as neat as the front",
    body: "I always turn a piece over before deciding. The floats are short and tied off properly, which is the difference between something that lasts a decade and something that snags in a season.",
  },
  {
    rating: 4,
    title: "Colour is truer in daylight",
    body: "Under indoor light it reads a little flatter than the photographs. Take it to a window and the depth comes back. No complaint, just something to expect.",
  },
  {
    rating: 5,
    title: "My tailor asked where it came from",
    body: "That is the review, really. He handles a lot of cloth and does not comment on much, and he wanted to know the source.",
  },
  {
    rating: 3,
    title: "Good piece, thin packaging",
    body: "The textile itself is exactly as described and I am keeping it. The outer carton arrived dented and the cloth bag inside had shifted — it survived, but only just.",
  },
  {
    rating: 5,
    title: "Weight tells you it is real",
    body: "You can feel the difference the moment you lift it. Nothing about it feels like a blend pretending to be silk.",
  },
  {
    rating: 4,
    title: "Sized generously",
    body: "Came out longer than the measurement given, which suited me but is worth knowing if you are matching a set. Finish along both selvedges is clean.",
  },
  {
    rating: 5,
    title: "Third order, same standard",
    body: "I keep coming back because the quality does not drift between orders. That consistency is rarer than a single good piece.",
  },
  {
    rating: 2,
    title: "Shade did not match the previous lot",
    body: "Ordered to extend an earlier length and the new cut is noticeably warmer. Fine on its own, unusable next to the old one. Dye lots vary, but the listing should say so.",
  },
  {
    rating: 5,
    title: "Border work is symmetrical throughout",
    body: "Checked along the whole length expecting the motif to drift, and it holds. Whoever set this up on the loom knew what they were doing.",
  },
  {
    rating: 4,
    title: "Comfortable through a long day",
    body: "Wore it from morning to late evening at a function and it breathed properly. Creases dropped out overnight on a hanger.",
  },
  {
    rating: 5,
    title: "Gifted, and immediately claimed",
    body: "Bought it intending to keep it and my sister-in-law saw it first. Ordering the same again rather than arguing.",
  },
  {
    rating: 3,
    title: "Lovely, but not an everyday piece",
    body: "The finish is genuinely good. It is more formal than the listing photographs suggest, so it has stayed in the cupboard more than I expected. My misjudgement rather than a fault.",
  },
  {
    rating: 4,
    title: "Print registration is tight",
    body: "Block printing usually shows a little overlap where the blocks meet. There is some here, as there should be, but it is even and clearly deliberate rather than careless.",
  },
  {
    rating: 5,
    title: "Held its colour through three washes",
    body: "Washed separately in cold water as instructed. No bleeding into the water at all after the first rinse, which I had half expected from a natural dye.",
  },
  {
    rating: 4,
    title: "Well packed for the distance",
    body: "Came a long way and arrived flat, dry and correctly folded, with the invoice inside. Small thing, but plenty of sellers get it wrong.",
  },
  {
    rating: 5,
    title: "Better in person than on screen",
    body: "The texture does not photograph. It looks fairly plain in the listing and has far more surface interest in the hand.",
  },
  {
    rating: 4,
    title: "Bought for a boutique run",
    body: "Took twenty-five metres to test with customers before committing further. Shade held across the whole cut and the hand feel is right for the price point.",
  },
  {
    rating: 5,
    title: "Exactly the weave I was looking for",
    body: "Had been trying to find this particular structure for months and most listings that claim it are something else. This is the real thing.",
  },
  {
    rating: 3,
    title: "Arrived later than estimated",
    body: "Eleven days against an estimate of four to six. The piece is good and support kept me updated, but the estimate at checkout was optimistic.",
  },
  {
    rating: 5,
    title: "Finish on the blouse piece matches",
    body: "Often the attached piece is an afterthought in a cheaper weave. Here it is the same quality as the body, which saved me hunting for a match.",
  },
  {
    rating: 4,
    title: "Understated, which is what I wanted",
    body: "Not everything needs to be heavy. This is quiet, well made and works without competing with the jewellery.",
  },
  {
    rating: 5,
    title: "Worth the wait for a handloom piece",
    body: "Ordered knowing it would take longer than a mill-made equivalent. The irregularities in the weave are exactly why you buy handloom in the first place.",
  },
];

/**
 * How many reviews each product gets, by position in the catalogue. Products
 * Not every delivery produces a review, but every product that has reached a
 * customer carries at least one.
 *
 * The first buyer of a product always reviews it, so no delivered product sits
 * on the storefront with no opinion on it at all. After that, one buyer in three
 * stays quiet, which is what makes rating *counts* vary between products instead
 * of every listing showing the same number.
 */
function writesAReview(position: number): boolean {
  return position === 0 || position % 3 !== 0;
}

/** The two documented customer logins, whose screens a reviewer actually opens. */
const DEMO_LOGINS = ["customer@saawariya.test", "wholesale@saawariya.test"];

export async function seedReviews(prisma: PrismaClient) {
  /**
   * The eligible set: one row per (customer, product) that customer has
   * actually received. This is the same condition `submitReview` enforces —
   * a DELIVERED sub-order — narrowed to approved products, because a customer
   * cannot review something the storefront never listed.
   *
   * Ordered so a re-seed produces byte-identical rows.
   */
  const deliveredLines = await prisma.orderItem.findMany({
    where: {
      subOrder: { status: "DELIVERED" },
      product: { status: "APPROVED" },
    },
    select: {
      productId: true,
      product: { select: { sku: true } },
      subOrder: {
        select: {
          deliveredAt: true,
          order: { select: { customer: { select: { userId: true } } } },
        },
      },
    },
    orderBy: [{ product: { sku: "asc" } }, { id: "asc" }],
  });

  await prisma.review.deleteMany({});

  if (deliveredLines.length === 0) {
    console.log("  Reviews: skipped (nothing has been delivered)");
    return;
  }

  // Collapse to unique (product, user) pairs — Review is uniquely keyed on that,
  // and a customer who bought the same piece twice still only gets one say.
  type Candidate = { productId: string; sku: string; userId: string; deliveredAt: Date | null };
  const seen = new Set<string>();
  const byProduct = new Map<string, Candidate[]>();
  const byUser = new Map<string, Candidate[]>();

  for (const line of deliveredLines) {
    const userId = line.subOrder.order.customer.userId;
    const key = `${line.productId}:${userId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const candidate: Candidate = {
      productId: line.productId,
      sku: line.product.sku,
      userId,
      deliveredAt: line.subOrder.deliveredAt,
    };

    byProduct.set(line.productId, [...(byProduct.get(line.productId) ?? []), candidate]);
    byUser.set(userId, [...(byUser.get(userId) ?? []), candidate]);
  }

  /**
   * Leave each demo login one delivered piece they have **not** reviewed.
   *
   * `/account/reviews` opens on a "Ready to review" list built from delivered
   * order lines with no review against them. Review everything a demo customer
   * has ever received and that list is empty on arrival — the same failure this
   * seed fixes everywhere else, on the one screen where the reviewer is meant to
   * write something themselves. Held back at the *product* level only where
   * another buyer can still speak for it, so no listing loses its only review.
   */
  const heldBack = new Set<string>();
  for (const email of DEMO_LOGINS) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) continue;

    const theirs = (byUser.get(user.id) ?? [])
      // Most recently delivered first: the piece they would be writing about.
      .slice()
      .sort((a, b) => (b.deliveredAt?.getTime() ?? 0) - (a.deliveredAt?.getTime() ?? 0));

    const spare = theirs.find((c) => (byProduct.get(c.productId)?.length ?? 0) > 1);
    const chosen = spare ?? theirs[0];
    if (chosen) heldBack.add(`${chosen.productId}:${chosen.userId}`);
  }

  let cursor = 0; // walks REVIEW_POOL
  let written = 0;
  let pending = 0;

  // Product order follows the SKU sort above, so the pool is walked in a stable
  // order and neighbouring products do not all draw the same few templates.
  for (const candidates of byProduct.values()) {
    let position = 0;

    for (const candidate of candidates) {
      if (heldBack.has(`${candidate.productId}:${candidate.userId}`)) continue;

      const index = position;
      position++;
      if (!writesAReview(index)) continue;

      const template = REVIEW_POOL[cursor % REVIEW_POOL.length];
      cursor++;

      // Roughly one in nine is left awaiting moderation, so the admin review
      // queue (SRS §47) has something in it.
      const isPending = written % 9 === 8;

      await prisma.review.create({
        data: {
          productId: candidate.productId,
          userId: candidate.userId,
          rating: template.rating,
          title: template.title,
          body: template.body,
          status: isPending ? "PENDING" : "APPROVED",
          // Written after the parcel arrived, never before. A review dated
          // ahead of its own delivery is the kind of detail that undoes an
          // otherwise convincing demo.
          createdAt: reviewedAt(candidate.deliveredAt, written),
        },
      });

      written++;
      if (isPending) pending++;
    }
  }

  // Recompute the denormalised counters from what was actually written.
  const approved = await prisma.review.groupBy({
    by: ["productId"],
    where: { status: "APPROVED" },
    _avg: { rating: true },
    _count: { _all: true },
  });

  await prisma.product.updateMany({ data: { ratingAvg: 0, ratingCount: 0 } });
  for (const row of approved) {
    await prisma.product.update({
      where: { id: row.productId },
      data: {
        // Ratings are stored as integers scaled by 10 — see src/lib/utils.ts.
        ratingAvg: Math.round((row._avg.rating ?? 0) * 10),
        ratingCount: row._count._all,
      },
    });
  }

  console.log(
    `  Reviews: ${written} across ${approved.length} products (${pending} awaiting moderation), every one a verified purchase`,
  );
}

/**
 * When the review was written: two to sixteen days after the parcel arrived,
 * spread deterministically so the dates do not all land together. Falls back to
 * a fixed recent date if a delivered sub-order somehow has no `deliveredAt`.
 */
function reviewedAt(deliveredAt: Date | null, n: number): Date {
  const base = deliveredAt ?? new Date(Date.UTC(2026, 6, 1, 9, 30));
  const days = 2 + (n % 15);
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000 + (n % 7) * 3600 * 1000);
}
