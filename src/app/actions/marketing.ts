"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminAction } from "@/lib/admin/context";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/admin/audit";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { campaignMovesFrom } from "@/lib/marketing/campaign-states";
import { resolveAudience } from "@/lib/marketing/audience";
import { LINKED_CMS_SLUGS } from "@/lib/marketing/content";
import {
  bannerSchema,
  bannerToggleSchema,
  broadcastSchema,
  campaignSchema,
  campaignStatusSchema,
  cmsPageSchema,
  couponSchema,
  couponToggleSchema,
} from "@/lib/validations/marketing";
import { fieldErrors, type ActionState } from "@/lib/validations/commerce";
import {
  CAMPAIGN_AUDIENCE_LABEL,
  CAMPAIGN_STATUS,
  DISCOUNT_TYPE,
  NOTIFICATION_CATEGORY,
} from "@/lib/constants";
import { formatPaise } from "@/lib/utils";

/**
 * Everything the marketing desk writes — SRS §123-129.
 *
 * All of it is gated on the specific permission rather than the Marketing role,
 * the same construction the rest of the build uses: SUPER_ADMIN holds every
 * permission, so an admin can fix a broken banner without a second role branch
 * that would have to be kept in sync with the RBAC matrix.
 *
 * Three of these actions change what the **public storefront** shows, so they
 * revalidate `/` and the pages that read them. A coupon or banner saved here and
 * not visible until the next deploy would be indistinguishable from a bug.
 */

// ---------------------------------------------------------------------------
// COUPONS
// ---------------------------------------------------------------------------

export async function saveCoupon(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.COUPON_MANAGE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = couponSchema.safeParse({
    id: formData.get("id") ?? undefined,
    code: formData.get("code"),
    discountType: formData.get("discountType"),
    percentValue: formData.get("percentValue") || undefined,
    fixedValue: formData.get("fixedValue") || undefined,
    minOrderValue: formData.get("minOrderValue") || undefined,
    maxDiscount: formData.get("maxDiscount") || undefined,
    usageLimit: formData.get("usageLimit") || undefined,
    perCustomerLimit: formData.get("perCustomerLimit") || 1,
    eligibility: formData.get("eligibility"),
    isActive: formData.get("isActive") === "on",
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      errors: fieldErrors(parsed.error),
      message: "Check the highlighted fields.",
    };
  }

  const data = parsed.data;

  /**
   * `discountValue` carries a percentage or an amount in paise depending on the
   * type, which is what the checkout's `computeDiscount` expects. Free shipping
   * carries zero — the type is the whole instruction.
   */
  const discountValue =
    data.discountType === DISCOUNT_TYPE.PERCENTAGE
      ? (data.percentValue ?? 0)
      : data.discountType === DISCOUNT_TYPE.FIXED
        ? (data.fixedValue ?? 0)
        : 0;

  const clash = await prisma.coupon.findUnique({
    where: { code: data.code },
    select: { id: true },
  });
  if (clash && clash.id !== data.id) {
    return {
      status: "error",
      errors: { code: [`“${data.code}” is already in use.`] },
      message: "That code already exists.",
    };
  }

  const payload = {
    code: data.code,
    discountType: data.discountType,
    discountValue,
    minOrderValue: data.minOrderValue ?? 0,
    // A cap only means anything on a percentage coupon; storing one against a
    // fixed discount would be a number no code path reads.
    maxDiscount:
      data.discountType === DISCOUNT_TYPE.PERCENTAGE && data.maxDiscount
        ? data.maxDiscount
        : null,
    usageLimit: data.usageLimit && data.usageLimit > 0 ? data.usageLimit : null,
    perCustomerLimit: data.perCustomerLimit,
    eligibility: data.eligibility,
    isActive: data.isActive ?? false,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
  };

  const coupon = data.id
    ? await prisma.coupon.update({ where: { id: data.id }, data: payload })
    : await prisma.coupon.create({ data: payload });

  await writeAudit({
    userId: auth.admin.userId,
    action: data.id
      ? AUDIT_ACTIONS.COUPON_UPDATED
      : AUDIT_ACTIONS.COUPON_CREATED,
    entityType: "Coupon",
    entityId: coupon.id,
    summary: `Coupon ${coupon.code} ${data.id ? "updated" : "created"} — ${describeCoupon(coupon)}`,
    meta: { ...payload, startsAt: undefined, endsAt: undefined },
  });

  revalidatePath("/admin/marketing/coupons");
  revalidatePath("/admin/marketing");
  // The cart lists the codes a shopper could plausibly use.
  revalidatePath("/cart");

  if (!data.id) redirect(`/admin/marketing/coupons/${coupon.id}`);

  return {
    status: "success",
    message: `Saved. ${coupon.code} is ${coupon.isActive ? "switched on" : "switched off"}.`,
  };
}

export async function toggleCoupon(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.COUPON_MANAGE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = couponToggleSchema.safeParse({
    id: formData.get("id"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const isActive = parsed.data.isActive === "true";
  const coupon = await prisma.coupon.update({
    where: { id: parsed.data.id },
    data: { isActive },
    select: { id: true, code: true },
  });

  await writeAudit({
    userId: auth.admin.userId,
    action: AUDIT_ACTIONS.COUPON_UPDATED,
    entityType: "Coupon",
    entityId: coupon.id,
    summary: `Coupon ${coupon.code} switched ${isActive ? "on" : "off"}`,
    meta: { isActive },
  });

  revalidatePath("/admin/marketing/coupons");
  revalidatePath("/cart");

  return {
    status: "success",
    message: `${coupon.code} is now ${isActive ? "live" : "switched off"}.`,
  };
}

function describeCoupon(coupon: {
  discountType: string;
  discountValue: number;
}): string {
  if (coupon.discountType === DISCOUNT_TYPE.PERCENTAGE) {
    return `${coupon.discountValue}% off`;
  }
  if (coupon.discountType === DISCOUNT_TYPE.FIXED) {
    return `${formatPaise(coupon.discountValue)} off`;
  }
  return "free shipping";
}

// ---------------------------------------------------------------------------
// BANNERS
// ---------------------------------------------------------------------------

export async function saveBanner(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.BANNER_MANAGE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = bannerSchema.safeParse({
    id: formData.get("id") ?? undefined,
    title: formData.get("title"),
    subtitle: formData.get("subtitle") || undefined,
    imageUrl: formData.get("imageUrl"),
    linkUrl: formData.get("linkUrl") || undefined,
    position: formData.get("position"),
    sortOrder: formData.get("sortOrder") || 0,
    isActive: formData.get("isActive") === "on",
    startsAt: formData.get("startsAt") || undefined,
    endsAt: formData.get("endsAt") || undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      errors: fieldErrors(parsed.error),
      message: "Check the highlighted fields.",
    };
  }

  const data = parsed.data;

  const payload = {
    title: data.title,
    subtitle: data.subtitle || null,
    imageUrl: data.imageUrl,
    linkUrl: data.linkUrl || null,
    position: data.position,
    sortOrder: data.sortOrder,
    isActive: data.isActive ?? false,
    startsAt: data.startsAt ? new Date(data.startsAt) : null,
    endsAt: data.endsAt ? new Date(data.endsAt) : null,
  };

  const banner = data.id
    ? await prisma.banner.update({ where: { id: data.id }, data: payload })
    : await prisma.banner.create({ data: payload });

  await writeAudit({
    userId: auth.admin.userId,
    action: data.id
      ? AUDIT_ACTIONS.BANNER_UPDATED
      : AUDIT_ACTIONS.BANNER_CREATED,
    entityType: "Banner",
    entityId: banner.id,
    summary: `Banner “${banner.title}” ${data.id ? "updated" : "created"} in ${banner.position}`,
    meta: { position: banner.position, isActive: banner.isActive },
  });

  revalidatePath("/admin/marketing/banners");
  revalidatePath("/admin/marketing");
  revalidatePath("/");

  if (!data.id) redirect(`/admin/marketing/banners/${banner.id}`);

  return {
    status: "success",
    message: `Saved. ${banner.isActive ? "It is live on the storefront now." : "It is switched off, so the storefront will not show it."}`,
  };
}

export async function toggleBanner(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.BANNER_MANAGE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = bannerToggleSchema.safeParse({
    id: formData.get("id"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const isActive = parsed.data.isActive === "true";
  const banner = await prisma.banner.update({
    where: { id: parsed.data.id },
    data: { isActive },
    select: { id: true, title: true },
  });

  await writeAudit({
    userId: auth.admin.userId,
    action: AUDIT_ACTIONS.BANNER_UPDATED,
    entityType: "Banner",
    entityId: banner.id,
    summary: `Banner “${banner.title}” switched ${isActive ? "on" : "off"}`,
    meta: { isActive },
  });

  revalidatePath("/admin/marketing/banners");
  revalidatePath("/");

  return {
    status: "success",
    message: `“${banner.title}” is now ${isActive ? "live" : "switched off"}.`,
  };
}

// ---------------------------------------------------------------------------
// CAMPAIGNS
// ---------------------------------------------------------------------------

export async function saveCampaign(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.CAMPAIGN_MANAGE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = campaignSchema.safeParse({
    id: formData.get("id") ?? undefined,
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    bannerUrl: formData.get("bannerUrl") || undefined,
    offerDetail: formData.get("offerDetail") || undefined,
    audience: formData.get("audience"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      errors: fieldErrors(parsed.error),
      message: "Check the highlighted fields.",
    };
  }

  const data = parsed.data;

  const payload = {
    name: data.name,
    description: data.description || null,
    bannerUrl: data.bannerUrl || null,
    offerDetail: data.offerDetail || null,
    audience: data.audience,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
  };

  const campaign = data.id
    ? await prisma.campaign.update({ where: { id: data.id }, data: payload })
    : await prisma.campaign.create({
        // A new campaign always starts as a draft. Creating one straight into
        // ACTIVE would skip the only review this workflow has.
        data: { ...payload, status: CAMPAIGN_STATUS.DRAFT },
      });

  await writeAudit({
    userId: auth.admin.userId,
    action: data.id
      ? AUDIT_ACTIONS.CAMPAIGN_UPDATED
      : AUDIT_ACTIONS.CAMPAIGN_CREATED,
    entityType: "Campaign",
    entityId: campaign.id,
    summary: `Campaign “${campaign.name}” ${data.id ? "updated" : "created"} for ${CAMPAIGN_AUDIENCE_LABEL[campaign.audience] ?? campaign.audience}`,
    meta: { audience: campaign.audience, status: campaign.status },
  });

  revalidatePath("/admin/marketing/campaigns");
  revalidatePath("/admin/marketing");

  if (!data.id) redirect(`/admin/marketing/campaigns/${campaign.id}`);

  return { status: "success", message: "Campaign saved." };
}

export async function moveCampaign(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.CAMPAIGN_MANAGE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = campaignStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error) };
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, name: true, status: true },
  });
  if (!campaign) return { status: "error", message: "Campaign not found." };

  // Re-checked on submit, exactly as the order and finance state machines are:
  // a button that is not drawn is not a control.
  if (!campaignMovesFrom(campaign.status).includes(parsed.data.status)) {
    return {
      status: "error",
      message: `A campaign cannot move from ${campaign.status.toLowerCase()} to ${parsed.data.status.toLowerCase()}.`,
    };
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: parsed.data.status },
  });

  await writeAudit({
    userId: auth.admin.userId,
    action: AUDIT_ACTIONS.CAMPAIGN_UPDATED,
    entityType: "Campaign",
    entityId: campaign.id,
    summary: `Campaign “${campaign.name}” moved to ${parsed.data.status.toLowerCase()}`,
    meta: { from: campaign.status, to: parsed.data.status },
  });

  revalidatePath("/admin/marketing/campaigns");
  revalidatePath(`/admin/marketing/campaigns/${campaign.id}`);
  revalidatePath("/admin/marketing");

  return {
    status: "success",
    message: `“${campaign.name}” is now ${parsed.data.status.toLowerCase()}.`,
  };
}

// ---------------------------------------------------------------------------
// CMS
// ---------------------------------------------------------------------------

export async function saveCmsPage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.CMS_MANAGE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = cmsPageSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    bodyHtml: formData.get("bodyHtml"),
    metaTitle: formData.get("metaTitle") || undefined,
    metaDescription: formData.get("metaDescription") || undefined,
    isPublished: formData.get("isPublished") === "on",
  });
  if (!parsed.success) {
    return {
      status: "error",
      errors: fieldErrors(parsed.error),
      message: "Check the highlighted fields.",
    };
  }

  const existing = await prisma.cmsPage.findUnique({
    where: { id: parsed.data.id },
    select: { slug: true },
  });
  if (!existing) return { status: "error", message: "Page not found." };

  const publishing = parsed.data.isPublished ?? false;
  const linkedFrom = LINKED_CMS_SLUGS[existing.slug];

  /**
   * Refuse to unpublish a page the rest of the site links to.
   *
   * `getCmsPage` filters on `isPublished`, so unpublishing `return-policy` would
   * 404 the footer link and the returns note on every product page. The rule
   * since Phase 3 is no dead links, and this is the screen that could create
   * seven of them in one click.
   */
  if (!publishing && linkedFrom) {
    return {
      status: "error",
      message: `“${existing.slug}” is linked from ${linkedFrom}. Unpublishing it would leave those links pointing at a 404 — edit the content instead.`,
    };
  }

  const page = await prisma.cmsPage.update({
    where: { id: parsed.data.id },
    data: {
      title: parsed.data.title,
      bodyHtml: parsed.data.bodyHtml,
      metaTitle: parsed.data.metaTitle || null,
      metaDescription: parsed.data.metaDescription || null,
      isPublished: publishing,
    },
  });

  await writeAudit({
    userId: auth.admin.userId,
    action: AUDIT_ACTIONS.CMS_PAGE_UPDATED,
    entityType: "CmsPage",
    entityId: page.id,
    summary: `Content page “${page.title}” (/page/${page.slug}) updated`,
    meta: { slug: page.slug, isPublished: page.isPublished },
  });

  revalidatePath("/admin/marketing/content");
  revalidatePath(`/admin/marketing/content/${page.slug}`);
  revalidatePath(`/page/${page.slug}`);

  return {
    status: "success",
    message: `Saved. /page/${page.slug} is ${page.isPublished ? "live" : "unpublished"}.`,
  };
}

// ---------------------------------------------------------------------------
// BROADCAST
// ---------------------------------------------------------------------------

export async function sendBroadcast(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.NOTIFICATION_BROADCAST);
  if (!auth.ok) return { status: "error", message: auth.error };

  const parsed = broadcastSchema.safeParse({
    audience: formData.get("audience"),
    title: formData.get("title"),
    body: formData.get("body"),
    linkUrl: formData.get("linkUrl") || undefined,
    campaignId: formData.get("campaignId") || undefined,
    confirm: formData.get("confirm") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      errors: fieldErrors(parsed.error),
      message: "Check the highlighted fields.",
    };
  }

  const recipients = await resolveAudience(parsed.data.audience);

  if (recipients.length === 0) {
    return {
      status: "error",
      message: `There is nobody in “${CAMPAIGN_AUDIENCE_LABEL[parsed.data.audience]}” to send to.`,
    };
  }

  /**
   * The typed confirmation. This is the only action in the build that writes to
   * every customer's account at once and there is no "unsend", so the count has
   * to be typed rather than clicked — and it is re-derived here rather than
   * taken from the form, so a stale page cannot confirm a number that is no
   * longer the audience.
   */
  if (parsed.data.confirm.trim() !== String(recipients.length)) {
    return {
      status: "error",
      errors: {
        confirm: [`Type ${recipients.length} to confirm.`],
      },
      message: `This will notify ${recipients.length} ${recipients.length === 1 ? "person" : "people"} and cannot be undone. Type the number to confirm.`,
    };
  }

  const campaign = parsed.data.campaignId
    ? await prisma.campaign.findUnique({
        where: { id: parsed.data.campaignId },
        select: { id: true, name: true },
      })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        title: parsed.data.title,
        body: parsed.data.body,
        category: NOTIFICATION_CATEGORY.PROMOTION,
        linkUrl: parsed.data.linkUrl || "/shop",
      })),
    });

    /**
     * The campaign's view counter is moved by this and by nothing else. There is
     * no analytics pipeline in this build, so a counter that grew on its own
     * would be a number the software cannot account for — the campaign screen
     * says exactly where these come from.
     */
    if (campaign) {
      await tx.campaign.update({
        where: { id: campaign.id },
        data: { viewCount: { increment: recipients.length } },
      });
    }

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: AUDIT_ACTIONS.NOTIFICATION_BROADCAST,
        entityType: campaign ? "Campaign" : "Notification",
        entityId: campaign?.id ?? parsed.data.audience,
        summary: `“${parsed.data.title}” broadcast to ${recipients.length} ${CAMPAIGN_AUDIENCE_LABEL[parsed.data.audience]?.toLowerCase() ?? parsed.data.audience}`,
        meta: {
          audience: parsed.data.audience,
          recipients: recipients.length,
          campaign: campaign?.name ?? null,
        },
      },
      tx,
    );
  });

  revalidatePath("/admin/marketing/audience");
  revalidatePath("/admin/marketing");

  return {
    status: "success",
    message: `Sent to ${recipients.length} ${recipients.length === 1 ? "person" : "people"}. They will see it in their notifications.`,
  };
}
