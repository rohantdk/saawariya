import bcrypt from "bcryptjs";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { CUSTOMER_TYPE, ROLES } from "../../src/lib/constants";

/**
 * Additional customer accounts beyond the two documented demo logins.
 *
 * These exist mainly so the catalogue has plausible review authors: Review is
 * uniquely keyed on (productId, userId), so with only the two demo customers no
 * product could ever carry more than two reviews, and every rating average on
 * the site would be visibly fake.
 *
 * They also give the wholesale tier (SRS §14) more than a single representative
 * once orders arrive in a later phase.
 */

type CustomerSeed = {
  email: string;
  fullName: string;
  mobile: string;
  type: "RETAIL" | "WHOLESALE";
  city: string;
  state: string;
  pinCode: string;
  line1: string;
  gstNumber?: string;
};

export const EXTRA_CUSTOMERS: CustomerSeed[] = [
  {
    email: "priya.nair@saawariya.test",
    fullName: "Priya Nair",
    mobile: "9810000031",
    type: CUSTOMER_TYPE.RETAIL,
    line1: "12B, Palm Grove Apartments, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    pinCode: "560038",
  },
  {
    email: "ananya.bose@saawariya.test",
    fullName: "Ananya Bose",
    mobile: "9810000032",
    type: CUSTOMER_TYPE.RETAIL,
    line1: "7/2 Lake Gardens, Near Rabindra Sarobar",
    city: "Kolkata",
    state: "West Bengal",
    pinCode: "700045",
  },
  {
    email: "kavitha.reddy@saawariya.test",
    fullName: "Kavitha Reddy",
    mobile: "9810000033",
    type: CUSTOMER_TYPE.RETAIL,
    line1: "301, Jubilee Enclave, Madhapur",
    city: "Hyderabad",
    state: "Telangana",
    pinCode: "500081",
  },
  {
    email: "farah.sheikh@saawariya.test",
    fullName: "Farah Sheikh",
    mobile: "9810000034",
    type: CUSTOMER_TYPE.RETAIL,
    line1: "88 Hazratganj, Near Residency",
    city: "Lucknow",
    state: "Uttar Pradesh",
    pinCode: "226001",
  },
  {
    email: "deepa.iyer@saawariya.test",
    fullName: "Deepa Iyer",
    mobile: "9810000035",
    type: CUSTOMER_TYPE.RETAIL,
    line1: "24, Besant Nagar 2nd Avenue",
    city: "Chennai",
    state: "Tamil Nadu",
    pinCode: "600090",
  },
  {
    email: "ritu.malhotra@saawariya.test",
    fullName: "Ritu Malhotra",
    mobile: "9810000036",
    type: CUSTOMER_TYPE.RETAIL,
    line1: "C-45, Greater Kailash Part 1",
    city: "New Delhi",
    state: "Delhi",
    pinCode: "110048",
  },
  {
    email: "sunita.desai@saawariya.test",
    fullName: "Sunita Desai",
    mobile: "9810000037",
    type: CUSTOMER_TYPE.RETAIL,
    line1: "Flat 9, Shivranjani Society, Satellite",
    city: "Ahmedabad",
    state: "Gujarat",
    pinCode: "380015",
  },
  {
    email: "lakshmi.boutique@saawariya.test",
    fullName: "Lakshmi Boutique & Sarees",
    mobile: "9810000038",
    type: CUSTOMER_TYPE.WHOLESALE,
    line1: "Shop 14, Commercial Street",
    city: "Bengaluru",
    state: "Karnataka",
    pinCode: "560001",
    gstNumber: "29AAFCL4567R1Z8",
  },
  {
    email: "sanskriti.exports@saawariya.test",
    fullName: "Sanskriti Exports",
    mobile: "9810000039",
    type: CUSTOMER_TYPE.WHOLESALE,
    line1: "Unit 3, Okhla Industrial Estate Phase 2",
    city: "New Delhi",
    state: "Delhi",
    pinCode: "110020",
    gstNumber: "07AAGCS8901T1Z4",
  },
];

export async function seedCustomers(prisma: PrismaClient) {
  const password = process.env.SEED_DEMO_PASSWORD ?? "Saawariya@123";
  const passwordHash = await bcrypt.hash(password, 12);

  for (const seed of EXTRA_CUSTOMERS) {
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: { fullName: seed.fullName, mobile: seed.mobile, roleCode: ROLES.CUSTOMER },
      create: {
        email: seed.email,
        mobile: seed.mobile,
        fullName: seed.fullName,
        passwordHash,
        roleCode: ROLES.CUSTOMER,
        status: "ACTIVE",
        emailVerified: true,
        mobileVerified: true,
      },
    });

    await prisma.customer.upsert({
      where: { userId: user.id },
      update: { customerType: seed.type, gstNumber: seed.gstNumber ?? null },
      create: {
        userId: user.id,
        customerType: seed.type,
        gstNumber: seed.gstNumber ?? null,
      },
    });

    await prisma.address.deleteMany({ where: { userId: user.id } });
    await prisma.address.create({
      data: {
        userId: user.id,
        label: seed.type === CUSTOMER_TYPE.WHOLESALE ? "Shop" : "Home",
        fullName: seed.fullName,
        mobile: seed.mobile,
        line1: seed.line1,
        city: seed.city,
        state: seed.state,
        pinCode: seed.pinCode,
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
    });
  }

  console.log(`  Customers: ${EXTRA_CUSTOMERS.length} additional (plus 2 demo logins)`);
}
