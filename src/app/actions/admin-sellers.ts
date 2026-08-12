"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminAction } from "@/lib/admin/context";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/admin/audit";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { REQUIRED_DOCS } from "@/lib/seller/profile";
import {
  sellerCommissionSchema,
  sellerDecisionSchema,
  sellerDocumentReviewSchema,
  sellerRejectSchema,
} from "@/lib/validations/admin";
import { fieldErrors, type ActionState } from "@/lib/validations/commerce";
import { SELLER_DOC_LABEL, SELLER_VERIFICATION } from "@/lib/constants";

/**
 * Seller verification — SRS §55, §74. The other half of Phase 5.
 *
 * `/seller/pending` already renders `Seller.verificationNote` and each
 * document's `status` and `reviewNote`; nothing wrote them until now. Every
 * action here is therefore a write the seller panel *reads*, which is what
 * makes the two panels demonstrable end to end.
 *
 * Three rules the whole module turns on:
 *
 * 1. **Approval is gated on all four KYC documents being APPROVED.**
 *    `/seller/pending` tells the seller, in as many words, "you can sell on
 *    Saawariya as soon as all four documents are approved". Letting an admin
 *    approve around that would make the page a lie — the same class of bug as
 *    the Phase 3 MOQ copy and the Phase 4 GST line. Seeded copy commits the
 *    software to something.
 *
 * 2. **Rejecting requires a reason, and the reason is the deliverable.** A
 *    rejection with no note leaves the seller on a dead-end screen that says
 *    they failed and not why. The schema enforces it; this file never has to.
 *
 * 3. **Approving is what makes their catalogue public.** The storefront queries
 *    filter on `seller.verificationStatus === APPROVED` (see
 *    src/lib/catalogue/queries.ts), so verification is not paperwork — it is
 *    the switch that puts a seller's approved products on sale, and suspending
 *    takes them straight back off. That is why these paths revalidate the
 *    storefront and not just the console.
 */

/** Storefront surfaces that change when a seller's trading status changes. */
function revalidateStorefront() {
  revalidatePath("/", "layout");
}

async function loadSeller(sellerId: string) {
  return prisma.seller.findUnique({
    where: { id: sellerId },
    select: {
      id: true,
      userId: true,
      businessName: true,
      verificationStatus: true,
      commissionPercent: true,
      documents: { select: { docType: true, status: true } },
    },
  });
}

function revalidateSeller(sellerId: string) {
  revalidatePath("/admin/sellers");
  revalidatePath(`/admin/sellers/${sellerId}`);
  // The seller's own screens read the very fields these actions write.
  revalidatePath("/seller/pending");
  revalidatePath("/seller/profile");
}

/**
 * Approve a seller application.
 *
 * The KYC gate is checked here rather than only hidden in the UI: the button is
 * not drawn when documents are outstanding, but a button that is not drawn is
 * not a control.
 */
export async function approveSeller(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.SELLER_APPROVE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = sellerDecisionSchema.safeParse({
    sellerId: formData.get("sellerId"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const seller = await loadSeller(parsed.data.sellerId);
  if (!seller) return { status: "error", message: "Seller not found." };

  if (seller.verificationStatus === SELLER_VERIFICATION.APPROVED) {
    return { status: "error", message: "That seller is already verified." };
  }

  const outstanding = REQUIRED_DOCS.filter(
    (docType) =>
      seller.documents.find((d) => d.docType === docType)?.status !==
      "APPROVED",
  );
  if (outstanding.length > 0) {
    return {
      status: "error",
      message: `Approve every KYC document first — outstanding: ${outstanding
        .map((docType) => SELLER_DOC_LABEL[docType] ?? docType)
        .join(", ")}.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.seller.update({
      where: { id: seller.id },
      data: {
        verificationStatus: SELLER_VERIFICATION.APPROVED,
        verificationNote: parsed.data.note || null,
        verifiedAt: new Date(),
      },
    });

    await tx.notification.create({
      data: {
        userId: seller.userId,
        title: "Your seller account is verified",
        body: "You can now list products and receive orders on Saawariya.",
        category: "SYSTEM",
        linkUrl: "/seller",
      },
    });

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: AUDIT_ACTIONS.SELLER_APPROVED,
        entityType: "Seller",
        entityId: seller.id,
        summary: `Seller ${seller.businessName} verified`,
        meta: { from: seller.verificationStatus },
      },
      tx,
    );
  });

  revalidateSeller(seller.id);
  revalidateStorefront();

  return {
    status: "success",
    message: `${seller.businessName} is verified and can now trade.`,
  };
}

/**
 * Reject an application. The note is required by the schema and is the only
 * thing the seller will see, so it is written verbatim to `verificationNote`.
 */
export async function rejectSeller(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.SELLER_APPROVE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = sellerRejectSchema.safeParse({
    sellerId: formData.get("sellerId"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const seller = await loadSeller(parsed.data.sellerId);
  if (!seller) return { status: "error", message: "Seller not found." };

  await prisma.$transaction(async (tx) => {
    await tx.seller.update({
      where: { id: seller.id },
      data: {
        verificationStatus: SELLER_VERIFICATION.REJECTED,
        verificationNote: parsed.data.note,
        verifiedAt: null,
      },
    });

    await tx.notification.create({
      data: {
        userId: seller.userId,
        title: "Your seller application needs attention",
        body: parsed.data.note,
        category: "SYSTEM",
        linkUrl: "/seller/pending",
      },
    });

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: AUDIT_ACTIONS.SELLER_REJECTED,
        entityType: "Seller",
        entityId: seller.id,
        summary: `Seller ${seller.businessName} rejected — ${parsed.data.note}`,
        meta: { from: seller.verificationStatus },
      },
      tx,
    );
  });

  revalidateSeller(seller.id);
  revalidateStorefront();

  return { status: "success", message: "Application rejected and the seller told why." };
}

/**
 * Move an application into review.
 *
 * A small state, but a load-bearing one: PENDING means "nobody has looked",
 * UNDER_REVIEW means "someone is on it". Without it a second admin cannot tell
 * the difference, and `/seller/pending` shows the seller a different, calmer
 * word for each.
 */
export async function startSellerReview(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.SELLER_APPROVE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = sellerDecisionSchema.safeParse({
    sellerId: formData.get("sellerId"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const seller = await loadSeller(parsed.data.sellerId);
  if (!seller) return { status: "error", message: "Seller not found." };

  if (seller.verificationStatus !== SELLER_VERIFICATION.PENDING) {
    return {
      status: "error",
      message: "Only a new application can be moved into review.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.seller.update({
      where: { id: seller.id },
      data: {
        verificationStatus: SELLER_VERIFICATION.UNDER_REVIEW,
        verificationNote: parsed.data.note || null,
      },
    });

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: AUDIT_ACTIONS.SELLER_REVIEW_STARTED,
        entityType: "Seller",
        entityId: seller.id,
        summary: `Verification of ${seller.businessName} started`,
      },
      tx,
    );
  });

  revalidateSeller(seller.id);
  return { status: "success", message: "Marked as under review." };
}

/**
 * Suspend a trading seller, or reinstate one.
 *
 * Suspension is not a soft flag. The storefront filters every catalogue query
 * on `seller.verificationStatus === APPROVED`, so this takes the seller's whole
 * catalogue off sale in one write — which is exactly what it should do, and why
 * it demands a reason.
 *
 * The seller's own `User` row is deliberately left ACTIVE: they keep their sign
 * in, land on `/seller/pending` and can read why. Locking them out of the
 * account that explains the suspension would be a support ticket by design.
 */
export async function suspendSeller(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.SELLER_MANAGE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = sellerRejectSchema.safeParse({
    sellerId: formData.get("sellerId"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const seller = await loadSeller(parsed.data.sellerId);
  if (!seller) return { status: "error", message: "Seller not found." };

  if (seller.verificationStatus === SELLER_VERIFICATION.SUSPENDED) {
    return { status: "error", message: "That seller is already suspended." };
  }

  const live = await prisma.product.count({
    where: { sellerId: seller.id, status: "APPROVED" },
  });

  await prisma.$transaction(async (tx) => {
    await tx.seller.update({
      where: { id: seller.id },
      data: {
        verificationStatus: SELLER_VERIFICATION.SUSPENDED,
        verificationNote: parsed.data.note,
      },
    });

    await tx.notification.create({
      data: {
        userId: seller.userId,
        title: "Your seller account has been suspended",
        body: parsed.data.note,
        category: "SYSTEM",
        linkUrl: "/seller/pending",
      },
    });

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: AUDIT_ACTIONS.SELLER_SUSPENDED,
        entityType: "Seller",
        entityId: seller.id,
        summary: `Seller ${seller.businessName} suspended — ${parsed.data.note}`,
        meta: { productsWithdrawn: live },
      },
      tx,
    );
  });

  revalidateSeller(seller.id);
  revalidateStorefront();

  return {
    status: "success",
    message:
      live > 0
        ? `Suspended. ${live} live product${live === 1 ? "" : "s"} withdrawn from the storefront.`
        : "Suspended.",
  };
}

/** Per-document KYC decision — SRS §54, §55. */
export async function reviewSellerDocument(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.SELLER_APPROVE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = sellerDocumentReviewSchema.safeParse({
    documentId: formData.get("documentId"),
    docType: formData.get("docType"),
    // The decision rides on the submit button's `value`, not on a control the
    // handler rewrites — see the Phase 5 note in the stock-adjust form.
    decision: formData.get("decision"),
    reviewNote: formData.get("reviewNote") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const document = await prisma.sellerDocument.findUnique({
    where: { id: parsed.data.documentId },
    select: {
      id: true,
      docType: true,
      status: true,
      seller: { select: { id: true, businessName: true, userId: true } },
    },
  });
  if (!document) return { status: "error", message: "Document not found." };

  const rejecting = parsed.data.decision === "REJECTED";
  const reviewNote = parsed.data.reviewNote?.trim() || null;

  // A rejected document is one the seller has to re-upload, and "rejected" on
  // its own does not say what was wrong with it.
  if (rejecting && !reviewNote) {
    return {
      status: "error",
      errors: { reviewNote: ["Say what is wrong with the document."] },
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.sellerDocument.update({
      where: { id: document.id },
      data: {
        status: parsed.data.decision,
        reviewNote,
        reviewedAt: new Date(),
      },
    });

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: AUDIT_ACTIONS.SELLER_DOCUMENT_REVIEWED,
        entityType: "SellerDocument",
        entityId: document.id,
        summary: `${SELLER_DOC_LABEL[document.docType] ?? document.docType} for ${
          document.seller.businessName
        } ${rejecting ? "rejected" : "approved"}${reviewNote ? ` — ${reviewNote}` : ""}`,
        meta: { sellerId: document.seller.id, from: document.status },
      },
      tx,
    );
  });

  revalidateSeller(document.seller.id);

  return {
    status: "success",
    message: `${SELLER_DOC_LABEL[document.docType] ?? document.docType} ${
      rejecting ? "rejected" : "approved"
    }.`,
  };
}

/**
 * Change a seller's commission rate — SRS §13.1, §119.
 *
 * Only affects settlements raised *after* the change. Existing `Settlement`
 * rows keep the `commissionPercent` they were calculated with, deliberately:
 * re-rating a payout that has already been reported would make two reports of
 * the same month disagree.
 */
export async function setSellerCommission(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.SELLER_MANAGE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = sellerCommissionSchema.safeParse({
    sellerId: formData.get("sellerId"),
    commissionPercent: formData.get("commissionPercent"),
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const seller = await loadSeller(parsed.data.sellerId);
  if (!seller) return { status: "error", message: "Seller not found." };

  if (seller.commissionPercent === parsed.data.commissionPercent) {
    return { status: "error", message: "That is already the commission rate." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.seller.update({
      where: { id: seller.id },
      data: { commissionPercent: parsed.data.commissionPercent },
    });

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: AUDIT_ACTIONS.SELLER_COMMISSION_CHANGED,
        entityType: "Seller",
        entityId: seller.id,
        summary: `Commission for ${seller.businessName} changed from ${seller.commissionPercent}% to ${parsed.data.commissionPercent}%`,
        meta: {
          from: seller.commissionPercent,
          to: parsed.data.commissionPercent,
        },
      },
      tx,
    );
  });

  revalidateSeller(seller.id);

  return {
    status: "success",
    message: `Commission set to ${parsed.data.commissionPercent}%. Existing settlements keep their original rate.`,
  };
}
