import type { PrismaClient } from "../../src/generated/prisma/client";

/**
 * What the two demo customers have set aside — their open bag (SRS §42 Shopping
 * Cart) and their saved items (SRS §41 Wishlist).
 *
 * Both tables live here because the storefront moves rows between them: "Save
 * for later" on a cart line is a move to the wishlist, and the wishlist offers
 * the return trip. Owning one and not the other is how a re-seed leaves a
 * customer with a wishlist referring to a catalogue that has been rebuilt.
 *
 * Why this exists at all: /cart and /checkout were the only screens a reviewer
 * arrived at empty, so the cart's real behaviour — per-seller grouping, the
 * wholesale price tier, MOQ, coupon validation, the order summary — was
 * invisible until they went and built a basket themselves. Every other queue in
 * this seed is deliberately non-empty for exactly that reason.
 *
 * It also fixes a quieter defect. Nothing owned CartItem, so cart rows survived
 * a re-seed while the products seed deletes and recreates ProductVariant on
 * every run. `CartItem.variantId` is a plain String with no foreign key (see the
 * note on the model), so those surviving rows kept pointing at variants that no
 * longer existed. The demo account's bag had accumulated three lines for the
 * same saree, all of them dangling, and `getCart` correctly rendered all three
 * as "no longer available" — an empty cart would have been the better outcome.
 * This module owns the table and rebuilds it, so a re-seed resets the bag.
 *
 * A cart is not a reservation: nothing here touches Inventory.reservedQty, which
 * only moves when an order is actually placed.
 */

type BasketLine = {
  /** Product slug — stable across re-seeds, unlike the cuid primary key. */
  slug: string;
  quantity: number;
  /**
   * The ProductVariant.value to add, for products that have variants. Variant
   * ids are regenerated on every seed run, so the line is expressed as the value
   * a customer would actually have clicked and resolved to an id here.
   */
  variantValue?: string;
};

type Basket = {
  email: string;
  /** What this basket is for, printed if it cannot be built. */
  intent: string;
  lines: BasketLine[];
  /**
   * Product slugs saved for later. No quantity and no variant — the wishlist
   * records interest in a piece, and the choice is made again on the way to the
   * bag.
   */
  saved: string[];
};

const BASKETS: Basket[] = [
  {
    email: "customer@saawariya.test",
    // Three sellers on purpose: the cart groups lines by seller because that
    // grouping is what becomes SubOrders, and a single-seller basket hides it.
    // Totals ~₹14,380, which clears the free-shipping threshold and VIVAAH15's
    // ₹10,000 minimum, so the coupon box has something that works. The offers
    // that are refused are just as useful: WELCOME10 is new-customers-only, and
    // this account has already used its one FESTIVE500. It also lands above the
    // ₹10,000 ceiling on Cash on Delivery, so that rule is visible too.
    // Was "three sellers, with one variant line" against the pre-2026-08-24
    // catalogue. All non-saree products (and 14 of the 19 seeded sarees) were
    // switched to HIDDEN that day — see prisma/seed/products.ts — leaving
    // only the five client-photographed sarees APPROVED, none of them
    // multi-seller and none with variants. Retargeted to what still exists;
    // the three/four-seller and "choose options" demonstrations this basket
    // used to carry are gone until the catalogue is reopened.
    intent: "retail bag of the five visible sarees, no variants left to demonstrate",
    lines: [
      { slug: "shimmer-tissue-saree-mauve-gold", quantity: 1 },
      { slug: "shimmer-tissue-saree-sea-green", quantity: 2 },
      { slug: "shimmer-tissue-saree-olive-gold", quantity: 1 },
    ],
    saved: [
      "shimmer-tissue-saree-coral-pink",
      "shimmer-tissue-saree-mustard-gold",
    ],
  },
  {
    email: "wholesale@saawariya.test",
    // Was "wholesale bag above MOQ on both lines" against two fabric-by-the-
    // metre products, both now HIDDEN (see the note above) — and none of the
    // five sarees left public carry an MOQ above 1, so there is no longer a
    // wholesale-eligible product to put in this bag. Per this file's own
    // rule ("an empty cart would have been the better outcome" than a line
    // seeded with a fault), left empty rather than forced onto a retail
    // product it cannot honestly demonstrate wholesale pricing on.
    intent: "wholesale bag — empty, no wholesale-eligible product is public",
    lines: [],
    saved: [],
  },
];

export async function seedBaskets(prisma: PrismaClient) {
  await prisma.cartItem.deleteMany({});
  await prisma.wishlistItem.deleteMany({});

  let lines = 0;
  let saved = 0;

  for (const basket of BASKETS) {
    const user = await prisma.user.findUnique({
      where: { email: basket.email },
      select: { customer: { select: { id: true } } },
    });

    const customerId = user?.customer?.id;
    if (!customerId) {
      throw new Error(
        `Cannot seed the ${basket.intent}: no customer account for ${basket.email}.`,
      );
    }

    for (const line of basket.lines) {
      const product = await prisma.product.findUnique({
        where: { slug: line.slug },
        select: {
          id: true,
          name: true,
          status: true,
          minOrderQty: true,
          maxOrderQty: true,
          seller: { select: { verificationStatus: true } },
          inventory: { select: { status: true, stockQty: true, reservedQty: true } },
          variants: { select: { id: true, value: true, stockQty: true } },
        },
      });

      if (!product) {
        throw new Error(`Cannot seed a basket line: no product with slug "${line.slug}".`);
      }

      // Everything below re-checks what src/lib/commerce/cart.ts would compute
      // when the page renders. A seeded line that arrives carrying an issue —
      // unavailable, out of stock, below MOQ — is worse than no line at all,
      // because it blocks checkout on a screen meant to demonstrate checkout.
      // So the seed fails loudly here rather than writing one.
      const fault = (why: string) =>
        new Error(`Cannot seed "${product.name}" into ${basket.email}'s bag: ${why}.`);

      if (product.status !== "APPROVED") {
        throw fault(`it is ${product.status}, so it is not publicly buyable`);
      }
      if (product.seller.verificationStatus !== "APPROVED") {
        throw fault("its seller is not approved, so it is not publicly buyable");
      }

      let variantId = "";
      let variantStock: number | null = null;

      if (line.variantValue !== undefined) {
        const variant = product.variants.find((v) => v.value === line.variantValue);
        if (!variant) {
          throw fault(
            `it has no variant "${line.variantValue}" (found: ${
              product.variants.map((v) => v.value).join(", ") || "none"
            })`,
          );
        }
        variantId = variant.id;
        variantStock = variant.stockQty;
      } else if (product.variants.length > 0) {
        // Silently adding the base product would put a line in the bag that the
        // customer could never have created from the product page.
        throw fault("it has variants, so the basket line must name one");
      }

      const inventory = product.inventory;
      if (!inventory) throw fault("it has no inventory row");
      if (inventory.status === "OUT_OF_STOCK" || inventory.status === "DISCONTINUED") {
        throw fault(`its inventory is ${inventory.status}`);
      }

      const available = Math.min(
        Math.max(0, inventory.stockQty - inventory.reservedQty),
        variantStock ?? Number.MAX_SAFE_INTEGER,
      );

      if (line.quantity > available) {
        throw fault(`only ${available} are available and the line asks for ${line.quantity}`);
      }
      if (line.quantity < product.minOrderQty) {
        throw fault(`the minimum order is ${product.minOrderQty}`);
      }
      if (line.quantity > product.maxOrderQty) {
        throw fault(`the maximum per order is ${product.maxOrderQty}`);
      }

      await prisma.cartItem.create({
        data: {
          customerId,
          productId: product.id,
          variantId,
          quantity: line.quantity,
        },
      });

      lines++;
    }

    for (const slug of basket.saved) {
      const product = await prisma.product.findUnique({
        where: { slug },
        select: {
          id: true,
          name: true,
          status: true,
          seller: { select: { verificationStatus: true } },
        },
      });

      if (!product) {
        throw new Error(`Cannot seed a saved item: no product with slug "${slug}".`);
      }

      // A saved item has no quantity to get wrong, but it is still a card that
      // links to a product page — and a wishlist pointing at something the
      // storefront 404s is a dead link on a screen the customer owns.
      if (
        product.status !== "APPROVED" ||
        product.seller.verificationStatus !== "APPROVED"
      ) {
        throw new Error(
          `Cannot save "${product.name}" for ${basket.email}: it is not publicly buyable, so the wishlist card would link to a 404.`,
        );
      }

      await prisma.wishlistItem.create({
        data: { customerId, productId: product.id },
      });

      saved++;
    }
  }

  console.log(
    `  Baskets: ${lines} cart lines and ${saved} saved items across ${BASKETS.length} demo customers`,
  );
}
