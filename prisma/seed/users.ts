import bcrypt from "bcryptjs";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { ROLES, type RoleCode } from "../../src/lib/constants";

/**
 * Demo accounts — one per role, so a reviewer can sign in as anybody without
 * creating data first. The credentials table in README.md mirrors this list.
 *
 * Every account shares SEED_DEMO_PASSWORD. That is fine for an evaluation build
 * running on a local machine; it would obviously not be acceptable in production,
 * which is why the password comes from the environment rather than being
 * hardcoded here.
 */

export type DemoAccount = {
  email: string;
  fullName: string;
  mobile: string;
  role: RoleCode;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "customer@saawariya.test", fullName: "Rahul Sharma", mobile: "9810000001", role: ROLES.CUSTOMER },
  { email: "wholesale@saawariya.test", fullName: "Meera Traders", mobile: "9810000002", role: ROLES.CUSTOMER },
  { email: "seller@saawariya.test", fullName: "Anil Textiles", mobile: "9810000003", role: ROLES.SELLER },
  { email: "warehouse@saawariya.test", fullName: "Warehouse Desk", mobile: "9810000004", role: ROLES.WAREHOUSE },
  { email: "qc@saawariya.test", fullName: "Quality Control", mobile: "9810000005", role: ROLES.QC },
  { email: "logistics@saawariya.test", fullName: "Logistics Desk", mobile: "9810000006", role: ROLES.LOGISTICS },
  { email: "finance@saawariya.test", fullName: "Finance Team", mobile: "9810000007", role: ROLES.FINANCE },
  { email: "support@saawariya.test", fullName: "Support Desk", mobile: "9810000008", role: ROLES.SUPPORT },
  { email: "marketing@saawariya.test", fullName: "Marketing Team", mobile: "9810000009", role: ROLES.MARKETING },
  { email: "admin@saawariya.test", fullName: "Saawariya Admin", mobile: "9810000010", role: ROLES.SUPER_ADMIN },
];

export async function seedUsers(prisma: PrismaClient) {
  const password = process.env.SEED_DEMO_PASSWORD ?? "Saawariya@123";
  const passwordHash = await bcrypt.hash(password, 12);

  for (const account of DEMO_ACCOUNTS) {
    const isWholesale = account.email.startsWith("wholesale@");

    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        fullName: account.fullName,
        mobile: account.mobile,
        roleCode: account.role,
        passwordHash,
      },
      create: {
        email: account.email,
        mobile: account.mobile,
        fullName: account.fullName,
        passwordHash,
        roleCode: account.role,
        status: "ACTIVE",
        emailVerified: true,
        mobileVerified: true,
      },
    });

    // Customers need a Customer row; retail and wholesale differ only by type.
    if (account.role === ROLES.CUSTOMER) {
      await prisma.customer.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          customerType: isWholesale ? "WHOLESALE" : "RETAIL",
          gstNumber: isWholesale ? "27AAPFU0939F1ZV" : null,
        },
      });

      await prisma.address.deleteMany({ where: { userId: user.id } });
      await prisma.address.create({
        data: {
          userId: user.id,
          label: "Home",
          fullName: account.fullName,
          mobile: account.mobile,
          line1: isWholesale ? "14, Ring Road Textile Market" : "402, Sunrise Residency",
          line2: isWholesale ? "Shop No. 22" : "Linking Road",
          city: isWholesale ? "Surat" : "Mumbai",
          state: isWholesale ? "Gujarat" : "Maharashtra",
          pinCode: isWholesale ? "395002" : "400050",
          isDefaultShipping: true,
          isDefaultBilling: true,
        },
      });
    }
  }

  console.log(`  Demo accounts: ${DEMO_ACCOUNTS.length} (password: ${password})`);
}
