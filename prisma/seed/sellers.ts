import bcrypt from "bcryptjs";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { ROLES, SELLER_VERIFICATION } from "../../src/lib/constants";

/**
 * Seller accounts spanning every verification state in SRS §55.
 *
 * The spread is deliberate. An admin reviewing this build should find the
 * seller-approval queue (SRS §74) already populated with real work — an
 * application waiting to be picked up, one mid-review, and one previously
 * rejected with a reason on file. A catalogue where every seller is already
 * APPROVED would leave that entire screen empty and untestable.
 *
 * `seller@saawariya.test` from the demo-account list is reused as the first
 * seller, so signing in with the documented credentials lands on a seller
 * dashboard that already has products, orders and settlements behind it.
 */

export type SellerSeed = {
  key: string; // stable handle used by the product seed
  email: string;
  ownerName: string;
  businessName: string;
  businessType: "MANUFACTURER" | "WHOLESALER" | "DISTRIBUTOR" | "RETAILER";
  mobile: string;
  gstNumber: string;
  panNumber: string;
  description: string;
  city: string;
  state: string;
  pinCode: string;
  addressLine: string;
  commissionPercent: number;
  verificationStatus: string;
  verificationNote?: string;
  documents: Array<{
    docType: "GST_CERTIFICATE" | "PAN_CARD" | "CANCELLED_CHEQUE" | "ADDRESS_PROOF";
    status: "PENDING" | "APPROVED" | "REJECTED";
    reviewNote?: string;
  }>;
};

const ALL_DOCS_APPROVED = [
  { docType: "GST_CERTIFICATE", status: "APPROVED" },
  { docType: "PAN_CARD", status: "APPROVED" },
  { docType: "CANCELLED_CHEQUE", status: "APPROVED" },
  { docType: "ADDRESS_PROOF", status: "APPROVED" },
] as SellerSeed["documents"];

export const SELLERS: SellerSeed[] = [
  {
    key: "anil",
    email: "seller@saawariya.test",
    ownerName: "Anil Kumar Gupta",
    businessName: "Anil Textiles",
    businessType: "MANUFACTURER",
    mobile: "9810000003",
    gstNumber: "09AAACA1234F1Z5",
    panNumber: "AAACA1234F",
    description:
      "Third-generation Banarasi weavers working the kadhwa and cutwork traditions from Madanpura, Varanasi. Supplying pure zari brocade since 1974.",
    addressLine: "18/3 Madanpura, Near Kabir Chaura",
    city: "Varanasi",
    state: "Uttar Pradesh",
    pinCode: "221001",
    commissionPercent: 10,
    verificationStatus: SELLER_VERIFICATION.APPROVED,
    documents: ALL_DOCS_APPROVED,
  },
  {
    key: "meenakshi",
    email: "meenakshi.silks@saawariya.test",
    ownerName: "Meenakshi Sundaram",
    businessName: "Meenakshi Silks",
    businessType: "MANUFACTURER",
    mobile: "9810000021",
    gstNumber: "33AABCM5678K1Z2",
    panNumber: "AABCM5678K",
    description:
      "Kanchipuram silk weavers specialising in korvai border sarees with pure mulberry silk and tested zari.",
    addressLine: "42 Gandhi Road, Pillaiyarpalayam",
    city: "Kanchipuram",
    state: "Tamil Nadu",
    pinCode: "631502",
    commissionPercent: 12,
    verificationStatus: SELLER_VERIFICATION.APPROVED,
    documents: ALL_DOCS_APPROVED,
  },
  {
    key: "chanderi",
    email: "chanderi.collective@saawariya.test",
    ownerName: "Sunita Koli",
    businessName: "Chanderi Handloom Collective",
    businessType: "MANUFACTURER",
    mobile: "9810000022",
    gstNumber: "23AACFC9012L1ZQ",
    panNumber: "AACFC9012L",
    description:
      "A 60-weaver co-operative in Pranpur village producing sheer silk-cotton Chanderi on pit looms.",
    addressLine: "Pranpur Craft Village, Post Chanderi",
    city: "Chanderi",
    state: "Madhya Pradesh",
    pinCode: "473446",
    commissionPercent: 8,
    verificationStatus: SELLER_VERIFICATION.APPROVED,
    documents: ALL_DOCS_APPROVED,
  },
  {
    key: "rajwadi",
    email: "rajwadi.prints@saawariya.test",
    ownerName: "Vikram Singh Rathore",
    businessName: "Rajwadi Prints",
    businessType: "WHOLESALER",
    mobile: "9810000023",
    gstNumber: "08AADFR3456M1ZX",
    panNumber: "AADFR3456M",
    description:
      "Hand block printers from Bagru and Sanganer working in natural indigo, madder and pomegranate dyes. Bulk fabric a speciality.",
    addressLine: "Plot 7, Bagru Textile Park",
    city: "Jaipur",
    state: "Rajasthan",
    pinCode: "303007",
    commissionPercent: 10,
    verificationStatus: SELLER_VERIFICATION.APPROVED,
    documents: ALL_DOCS_APPROVED,
  },
  {
    key: "bengal",
    email: "bengal.loom@saawariya.test",
    ownerName: "Prasenjit Das",
    businessName: "Bengal Loom House",
    businessType: "DISTRIBUTOR",
    mobile: "9810000024",
    gstNumber: "19AAECB7890N1ZY",
    panNumber: "AAECB7890N",
    description:
      "Jamdani, tant and baluchari from Phulia and Shantipur, sourced directly from weaver families.",
    addressLine: "Natun Phulia, Santipur Block",
    city: "Nadia",
    state: "West Bengal",
    pinCode: "741402",
    commissionPercent: 10,
    // Mid-review: bank proof still outstanding, so the admin queue has an item
    // that is genuinely actionable rather than merely decorative.
    verificationStatus: SELLER_VERIFICATION.UNDER_REVIEW,
    verificationNote:
      "GST and PAN verified. Awaiting a legible cancelled cheque — the uploaded scan is cropped.",
    documents: [
      { docType: "GST_CERTIFICATE", status: "APPROVED" },
      { docType: "PAN_CARD", status: "APPROVED" },
      { docType: "CANCELLED_CHEQUE", status: "REJECTED", reviewNote: "Account number not readable." },
      { docType: "ADDRESS_PROOF", status: "PENDING" },
    ],
  },
  {
    key: "surat",
    email: "surat.fabric@saawariya.test",
    ownerName: "Hiren Patel",
    businessName: "Surat Fabric Mart",
    businessType: "WHOLESALER",
    mobile: "9810000025",
    gstNumber: "24AAGFS2345P1ZK",
    panNumber: "AAGFS2345P",
    description:
      "Georgette, crepe and organza yardage from the Surat mills. Minimum order 50 metres.",
    addressLine: "Shop 212, Millennium Textile Market",
    city: "Surat",
    state: "Gujarat",
    pinCode: "395002",
    commissionPercent: 10,
    // Fresh application, nothing reviewed yet — the top of the approval queue.
    verificationStatus: SELLER_VERIFICATION.PENDING,
    documents: [
      { docType: "GST_CERTIFICATE", status: "PENDING" },
      { docType: "PAN_CARD", status: "PENDING" },
      { docType: "CANCELLED_CHEQUE", status: "PENDING" },
      { docType: "ADDRESS_PROOF", status: "PENDING" },
    ],
  },
  {
    key: "depot",
    email: "gupta.depot@saawariya.test",
    ownerName: "Ramesh Gupta",
    businessName: "Gupta Textiles Depot",
    businessType: "RETAILER",
    mobile: "9810000026",
    gstNumber: "07AAHFG6789Q1ZB",
    panNumber: "AAHFG6789Q",
    description: "General textile retailer, Karol Bagh.",
    addressLine: "2145 Ajmal Khan Road, Karol Bagh",
    city: "New Delhi",
    state: "Delhi",
    pinCode: "110005",
    commissionPercent: 10,
    verificationStatus: SELLER_VERIFICATION.REJECTED,
    verificationNote:
      "GST number does not match the registered business name on the GSTIN portal. Re-apply with corrected documents.",
    documents: [
      { docType: "GST_CERTIFICATE", status: "REJECTED", reviewNote: "GSTIN/name mismatch." },
      { docType: "PAN_CARD", status: "APPROVED" },
      { docType: "CANCELLED_CHEQUE", status: "PENDING" },
      { docType: "ADDRESS_PROOF", status: "PENDING" },
    ],
  },
];

/** Bank details are generated rather than listed — they carry no meaning here. */
function bankFor(seed: SellerSeed, index: number) {
  return {
    bankAccountName: seed.businessName,
    bankAccountNumber: `5010${String(index + 1).padStart(4, "0")}${seed.pinCode}`,
    bankIfsc: `HDFC000${String(1000 + index * 7)}`,
  };
}

export async function seedSellers(prisma: PrismaClient) {
  const password = process.env.SEED_DEMO_PASSWORD ?? "Saawariya@123";
  const passwordHash = await bcrypt.hash(password, 12);

  /** key -> Seller.id, so the product seed can attach stock to the right seller. */
  const sellerIds = new Map<string, string>();

  for (const [index, seed] of SELLERS.entries()) {
    const approved = seed.verificationStatus === SELLER_VERIFICATION.APPROVED;

    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: { fullName: seed.ownerName, mobile: seed.mobile, roleCode: ROLES.SELLER },
      create: {
        email: seed.email,
        mobile: seed.mobile,
        fullName: seed.ownerName,
        passwordHash,
        roleCode: ROLES.SELLER,
        // A seller awaiting verification cannot yet trade — SRS §55.
        status: approved ? "ACTIVE" : "PENDING",
        emailVerified: true,
        mobileVerified: true,
      },
    });

    const data = {
      businessName: seed.businessName,
      ownerName: seed.ownerName,
      businessType: seed.businessType,
      gstNumber: seed.gstNumber,
      panNumber: seed.panNumber,
      description: seed.description,
      addressLine: seed.addressLine,
      city: seed.city,
      state: seed.state,
      pinCode: seed.pinCode,
      pickupAddress: `${seed.addressLine}, ${seed.city} ${seed.pinCode}`,
      commissionPercent: seed.commissionPercent,
      verificationStatus: seed.verificationStatus,
      verificationNote: seed.verificationNote ?? null,
      verifiedAt: approved ? new Date("2026-06-15T10:00:00Z") : null,
      ...bankFor(seed, index),
    };

    const seller = await prisma.seller.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    });
    sellerIds.set(seed.key, seller.id);

    // Documents have no natural unique key, so replace rather than upsert —
    // this keeps re-seeding idempotent instead of stacking duplicate KYC rows.
    await prisma.sellerDocument.deleteMany({ where: { sellerId: seller.id } });
    await prisma.sellerDocument.createMany({
      data: seed.documents.map((doc) => ({
        sellerId: seller.id,
        docType: doc.docType,
        // Placeholder KYC scans — no real document images ship with a demo build.
        fileUrl: `/documents/${seed.key}-${doc.docType.toLowerCase()}.pdf`,
        status: doc.status,
        reviewNote: doc.reviewNote ?? null,
        reviewedAt: doc.status === "PENDING" ? null : new Date("2026-06-14T09:30:00Z"),
      })),
    });
  }

  const counts = SELLERS.reduce<Record<string, number>>((acc, s) => {
    acc[s.verificationStatus] = (acc[s.verificationStatus] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `  Sellers: ${SELLERS.length} (` +
      Object.entries(counts)
        .map(([k, v]) => `${v} ${k.toLowerCase()}`)
        .join(", ") +
      ")",
  );

  return sellerIds;
}
