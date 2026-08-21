/**
 * Database seed.
 *
 * Run by `npm run setup`, or on its own with `npm run db:seed`.
 * Every step upserts (or replaces its own rows), so re-running is safe and
 * idempotent — seeding twice must leave the database identical to seeding once.
 *
 * Order matters:
 *   roles      -> users can reference a role
 *   users      -> sellers and customers hang off a user
 *   categories -> products need a category
 *   sellers    -> products need a seller
 *   content    -> orders reference coupons
 *   orders     -> support tickets reference orders
 *   orders     -> reviews are only written for delivered order lines
 *   orders     -> baskets check stock against the reservations orders create
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedRoles } from "./seed/roles";
import { seedUsers } from "./seed/users";
import { seedCustomers } from "./seed/customers";
import { seedSellers } from "./seed/sellers";
import { seedClusters } from "./seed/clusters";
import { seedCategories } from "./seed/categories";
import { seedProducts } from "./seed/products";
import { seedReviews } from "./seed/reviews";
import { seedContent } from "./seed/content";
import { seedOrders } from "./seed/orders";
import { seedBaskets } from "./seed/baskets";
import { seedSupport } from "./seed/support";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("\nSeeding Saawariya demo data\n");

  console.log("- Roles & permissions");
  await seedRoles(prisma);

  console.log("- Demo accounts");
  await seedUsers(prisma);

  console.log("- Customers");
  await seedCustomers(prisma);

  console.log("- Sellers & KYC documents");
  const sellerIds = await seedSellers(prisma);

  // After sellers: a cluster is linked by pointing its sellers at it, so the
  // seller rows have to exist first.
  console.log("- Weaving clusters");
  await seedClusters(prisma, sellerIds);

  console.log("- Categories");
  await seedCategories(prisma);

  console.log("- Products, images, variants & inventory");
  await seedProducts(prisma, sellerIds);

  console.log("- Banners, coupons, campaigns, pages & settings");
  await seedContent(prisma);

  console.log("- Orders, payments, shipments & stock reservations");
  await seedOrders(prisma);

  // After orders, not before: a review is only valid for a product the customer
  // has actually received, so the reviews are derived from delivered order
  // lines. Running this first — as it did until the reviews seed started
  // honouring that rule — reads the *previous* run's orders, which seedOrders
  // has just deleted.
  console.log("- Reviews & rating rollup");
  await seedReviews(prisma);

  // After orders: a basket line is checked against stock minus what placed
  // orders already reserve, and seedOrders is what recomputes reservedQty.
  console.log("- Demo customer baskets");
  await seedBaskets(prisma);

  console.log("- Support tickets");
  await seedSupport(prisma);

  console.log("\nSeed complete.\n");
}

main()
  .catch((error) => {
    console.error("\nSeed failed:\n", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
