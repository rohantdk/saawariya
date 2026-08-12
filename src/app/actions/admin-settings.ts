"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminAction } from "@/lib/admin/context";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/admin/audit";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { validateSettingValue } from "@/lib/validations/admin";
import type { ActionState } from "@/lib/validations/commerce";

/**
 * Writing platform settings — SRS §87.
 *
 * One category is saved at a time, and the whole category is saved as a unit so
 * that a form which failed validation on one field does not half-apply. Values
 * are validated against each row's own `valueType` plus the per-key bounds in
 * `SETTING_BOUNDS` — a GST rate of 900 is a valid integer and a catastrophe.
 *
 * **Only keys that already exist are written.** A posted field naming a key
 * that is not in the table is ignored rather than created: the seed defines the
 * settings the application actually reads, and letting a form invent rows would
 * fill the table with keys nothing consults.
 */
export async function updateSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdminAction(PERMISSIONS.SETTINGS_MANAGE);
  if (!auth.ok) return { status: "error", message: auth.error };

  const category = String(formData.get("category") ?? "");
  if (!category) return { status: "error", message: "Missing settings group." };

  const rows = await prisma.setting.findMany({
    where: { category },
    select: { key: true, value: true, valueType: true, label: true },
  });
  if (rows.length === 0) {
    return { status: "error", message: "No settings in that group." };
  }

  const errors: Record<string, string[]> = {};
  const changes: { key: string; label: string; from: string; to: string }[] = [];

  for (const row of rows) {
    // A checkbox that is off posts nothing at all, which is not the same as a
    // missing field for a text input — so booleans read the presence of the
    // box, and everything else is skipped when absent.
    const raw =
      row.valueType === "BOOLEAN"
        ? formData.get(row.key) === "on"
          ? "true"
          : "false"
        : formData.get(row.key);

    if (raw === null || raw === undefined) continue;

    const result = validateSettingValue(row.key, row.valueType, String(raw));
    if (!result.ok) {
      errors[row.key] = [result.error];
      continue;
    }

    if (result.value !== row.value) {
      changes.push({
        key: row.key,
        label: row.label,
        from: row.value,
        to: result.value,
      });
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      errors,
      message: "Nothing was saved — fix the highlighted values.",
    };
  }

  if (changes.length === 0) {
    return { status: "error", message: "Nothing changed in this group." };
  }

  await prisma.$transaction(async (tx) => {
    for (const change of changes) {
      await tx.setting.update({
        where: { key: change.key },
        data: { value: change.to },
      });
    }

    await writeAudit(
      {
        userId: auth.admin.userId,
        action: AUDIT_ACTIONS.SETTINGS_CHANGED,
        entityType: "Setting",
        entityId: category,
        summary: `${category} settings changed — ${changes
          .map((c) => `${c.label} ${c.from} → ${c.to}`)
          .join("; ")}`,
        meta: { changes },
      },
      tx,
    );
  });

  revalidatePath("/admin/settings");
  // Several of these are read on every storefront and checkout render — GST,
  // shipping thresholds, the COD switch — so the whole tree is revalidated
  // rather than guessing which pages quoted which number.
  revalidatePath("/", "layout");

  return {
    status: "success",
    message: `Saved ${changes.length} change${changes.length === 1 ? "" : "s"}. Checkout and the storefront use the new values immediately.`,
  };
}
