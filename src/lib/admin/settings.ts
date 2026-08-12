import "server-only";
import { prisma } from "@/lib/prisma";
import {
  SETTING_CATEGORIES,
  type SettingRow,
} from "@/lib/admin/setting-meta";

/**
 * Platform settings — SRS §87.
 *
 * The `Setting` table is a typed key/value store, and this module reads it as
 * data rather than as a fixed form: the screen is generated from the rows, so a
 * key added by a later migration becomes editable without a code change here.
 * `valueType` is what decides which control renders and how the value is
 * validated on the way back in (`validateSettingValue`).
 *
 * These rows are not decoration. `src/lib/commerce/settings.ts` reads them at
 * checkout, so the GST rate, the free-shipping threshold, the COD limit and the
 * returns window on this screen all change what a customer is charged and
 * offered. The constants in `src/lib/constants.ts` remain the fallback for a
 * database that has never been seeded.
 *
 * The category list and the flags the *form* needs live in
 * `src/lib/admin/setting-meta.ts` — this module is `server-only`, and a Client
 * Component importing a value from it drags Prisma into the browser bundle.
 */

export async function getSettingsByCategory(): Promise<
  { key: string; label: string; blurb: string; settings: SettingRow[] }[]
> {
  const rows = await prisma.setting.findMany({
    orderBy: { key: "asc" },
    select: {
      key: true,
      value: true,
      label: true,
      valueType: true,
      category: true,
      updatedAt: true,
    },
  });

  const byCategory = new Map<string, SettingRow[]>();
  for (const row of rows) {
    const list = byCategory.get(row.category) ?? [];
    list.push(row);
    byCategory.set(row.category, list);
  }

  const known = SETTING_CATEGORIES.map((category) => ({
    ...category,
    settings: byCategory.get(category.key) ?? [],
  })).filter((group) => group.settings.length > 0);

  // A category the seed does not know about still has to render, or a setting
  // added later would be silently uneditable.
  const extras = [...byCategory.keys()]
    .filter((key) => !SETTING_CATEGORIES.some((c) => c.key === key))
    .map((key) => ({
      key,
      label: key.charAt(0) + key.slice(1).toLowerCase(),
      blurb: "",
      settings: byCategory.get(key)!,
    }));

  return [...known, ...extras];
}
