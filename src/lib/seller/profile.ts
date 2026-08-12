import "server-only";
import { prisma } from "@/lib/prisma";
import { SELLER_DOC_TYPE, type SellerDocType } from "@/lib/constants";

/**
 * The seller's own business record — profile, pickup address, bank details and
 * KYC (SRS §54, §55, §57).
 *
 * This is the one seller module an *unapproved* seller may use, which is why it
 * takes a seller id rather than the approved-only context: it backs
 * `/seller/pending` and `/seller/profile` alike.
 */

export async function getSellerProfile(sellerId: string) {
  return prisma.seller.findUnique({
    where: { id: sellerId },
    select: {
      id: true,
      businessName: true,
      ownerName: true,
      businessType: true,
      gstNumber: true,
      panNumber: true,
      description: true,
      logoUrl: true,
      verificationStatus: true,
      verificationNote: true,
      verifiedAt: true,
      addressLine: true,
      city: true,
      state: true,
      pinCode: true,
      pickupAddress: true,
      bankAccountName: true,
      bankAccountNumber: true,
      bankIfsc: true,
      commissionPercent: true,
      createdAt: true,
      user: { select: { email: true, mobile: true, fullName: true } },
      documents: {
        orderBy: { uploadedAt: "asc" },
        select: {
          id: true,
          docType: true,
          fileUrl: true,
          status: true,
          reviewNote: true,
          uploadedAt: true,
          reviewedAt: true,
        },
      },
    },
  });
}

export type SellerProfile = NonNullable<
  Awaited<ReturnType<typeof getSellerProfile>>
>;

/**
 * KYC as a fixed four-row checklist rather than "the documents that exist".
 *
 * A seller who has uploaded nothing needs to see four outstanding items, not an
 * empty list — an empty table reads as "nothing required". So the required set
 * is the source of truth and uploaded rows are matched onto it.
 */
export const REQUIRED_DOCS: SellerDocType[] = [
  SELLER_DOC_TYPE.GST_CERTIFICATE,
  SELLER_DOC_TYPE.PAN_CARD,
  SELLER_DOC_TYPE.CANCELLED_CHEQUE,
  SELLER_DOC_TYPE.ADDRESS_PROOF,
];

export type KycRow = {
  docType: SellerDocType;
  document: SellerProfile["documents"][number] | null;
};

export function kycChecklist(documents: SellerProfile["documents"]): KycRow[] {
  return REQUIRED_DOCS.map((docType) => ({
    docType,
    document: documents.find((d) => d.docType === docType) ?? null,
  }));
}

/** How complete the application is, for the progress line on /seller/pending. */
export function kycProgress(documents: SellerProfile["documents"]) {
  const rows = kycChecklist(documents);
  return {
    total: rows.length,
    approved: rows.filter((r) => r.document?.status === "APPROVED").length,
    rejected: rows.filter((r) => r.document?.status === "REJECTED").length,
    missing: rows.filter((r) => !r.document).length,
  };
}
