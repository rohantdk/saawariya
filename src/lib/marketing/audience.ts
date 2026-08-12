import "server-only";
import { prisma } from "@/lib/prisma";
import {
  CAMPAIGN_AUDIENCE,
  CUSTOMER_TYPE,
  ORDER_STATUS,
  ROLES,
  USER_STATUS,
} from "@/lib/constants";

/**
 * Who a broadcast reaches — SRS §128, §155.
 *
 * A notification broadcast is the one marketing action that writes to other
 * people's accounts, so the audience is resolved to a **concrete list of user
 * ids** before anything is written, and the panel is shown the count first. A
 * "send to everyone" button that does not say how many people that is, is a
 * button nobody can use responsibly.
 *
 * Two constraints that are not obvious:
 *
 * - Only `CUSTOMER` accounts are ever in scope. `NOTIFICATION_BROADCAST` is a
 *   marketing permission, and a promotional message in a warehouse operator's
 *   notification tray is noise in a queue they use to do their job.
 * - Suspended users are excluded. They cannot sign in, so a notification for
 *   them is a row nobody will read, and it would inflate every count on the
 *   campaign it belongs to.
 *
 * There is no email or SMS gateway in this build. The broadcast writes `IN_APP`
 * notifications, which are real and which the recipient genuinely sees at
 * `/account/notifications` — the panel says exactly that rather than offering
 * channel checkboxes that would do nothing.
 */

export async function resolveAudience(audience: string): Promise<string[]> {
  const base = {
    roleCode: ROLES.CUSTOMER,
    status: USER_STATUS.ACTIVE,
  };

  if (audience === CAMPAIGN_AUDIENCE.WHOLESALE) {
    const users = await prisma.user.findMany({
      where: { ...base, customer: { customerType: CUSTOMER_TYPE.WHOLESALE } },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  if (
    audience === CAMPAIGN_AUDIENCE.NEW_CUSTOMERS ||
    audience === CAMPAIGN_AUDIENCE.RETURNING
  ) {
    // "New" means no order that survived — a customer whose only order was
    // cancelled has still never bought anything, and telling them "welcome
    // back" would be wrong in the one direction that reads as a bug.
    const customers = await prisma.customer.findMany({
      where: { user: base },
      select: {
        userId: true,
        _count: {
          select: { orders: { where: { status: { not: ORDER_STATUS.CANCELLED } } } },
        },
      },
    });

    return customers
      .filter((customer) =>
        audience === CAMPAIGN_AUDIENCE.NEW_CUSTOMERS
          ? customer._count.orders === 0
          : customer._count.orders > 0,
      )
      .map((customer) => customer.userId);
  }

  const users = await prisma.user.findMany({
    where: base,
    select: { id: true },
  });
  return users.map((user) => user.id);
}

/** Headline sizes for the broadcast form, so the count is known before sending. */
export async function audienceSizes() {
  const audiences = [
    CAMPAIGN_AUDIENCE.ALL,
    CAMPAIGN_AUDIENCE.NEW_CUSTOMERS,
    CAMPAIGN_AUDIENCE.RETURNING,
    CAMPAIGN_AUDIENCE.WHOLESALE,
  ];

  const sizes: Record<string, number> = {};
  for (const audience of audiences) {
    sizes[audience] = (await resolveAudience(audience)).length;
  }
  return sizes;
}

// ---------------------------------------------------------------------------
// NEWSLETTER — SRS §155
// ---------------------------------------------------------------------------

export const SUBSCRIBERS_PAGE_SIZE = 50;

export async function listSubscribers(
  options: { includeUnsubscribed?: boolean; q?: string; page?: number } = {},
) {
  const where = {
    ...(options.includeUnsubscribed ? {} : { unsubscribedAt: null }),
    ...(options.q ? { email: { contains: options.q } } : {}),
  };

  const total = await prisma.newsletterSubscriber.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / SUBSCRIBERS_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount);

  const subscribers = await prisma.newsletterSubscriber.findMany({
    where,
    orderBy: { subscribedAt: "desc" },
    skip: (page - 1) * SUBSCRIBERS_PAGE_SIZE,
    take: SUBSCRIBERS_PAGE_SIZE,
  });

  const [active, unsubscribed] = await Promise.all([
    prisma.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
    prisma.newsletterSubscriber.count({
      where: { unsubscribedAt: { not: null } },
    }),
  ]);

  return { subscribers, total, page, pageCount, active, unsubscribed };
}

/** Broadcasts already sent, read back off the notifications they wrote. */
export async function recentBroadcasts(take = 8) {
  const grouped = await prisma.notification.groupBy({
    by: ["title"],
    where: { category: "PROMOTION" },
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take,
  });

  return grouped.map((row) => ({
    title: row.title,
    recipients: row._count._all,
    sentAt: row._max.createdAt,
  }));
}
