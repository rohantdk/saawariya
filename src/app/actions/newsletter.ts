"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";

/**
 * Newsletter signup — SRS §155, §146.
 *
 * Writes a real NewsletterSubscriber row, which is the same table the admin
 * marketing panel reads in Phase 8. Nothing here is a mock.
 */

const subscribeSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
});

export type SubscribeState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export async function subscribeToNewsletter(
  _prevState: SubscribeState,
  formData: FormData,
): Promise<SubscribeState> {
  const parsed = subscribeSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Enter a valid email address.",
    };
  }

  const { email } = parsed.data;

  const existing = await prisma.newsletterSubscriber.findUnique({
    where: { email },
    select: { id: true, unsubscribedAt: true },
  });

  if (existing && !existing.unsubscribedAt) {
    // Deliberately the same friendly wording as a fresh signup rather than
    // "you are already subscribed" — the form would otherwise report, to
    // anyone who asks, whether a given address is on the list.
    return { status: "success", message: "Thank you — you are on the list." };
  }

  if (existing) {
    // Re-subscribing after opting out: clear the flag rather than create a
    // second row for the same address.
    await prisma.newsletterSubscriber.update({
      where: { email },
      data: { unsubscribedAt: null, subscribedAt: new Date() },
    });
  } else {
    await prisma.newsletterSubscriber.create({ data: { email } });
  }

  return { status: "success", message: "Thank you — you are on the list." };
}
