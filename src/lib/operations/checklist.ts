import { QC_CHECKLIST, QC_REJECTION_REASONS } from "@/lib/constants";

/**
 * The QC checklist, as pure functions.
 *
 * Split out of `src/lib/operations/qc.ts` — which is `server-only` and reaches
 * for `prisma` — because the inspection form is a Client Component and needs
 * `checklistFieldName` to name its checkboxes the same way the parser reads
 * them. **A `server-only` module may export a type to a Client Component, never
 * a value**: importing one drags `better-sqlite3`, a native binding, into the
 * browser bundle. `tsc --noEmit` and `eslint` both pass; only `next build`
 * fails, with a `node:module` chunking error. Phase 6 learned this the hard way
 * with the admin settings form and Phase 7 walked into it again, which is why
 * the rule is repeated here rather than left in the memory of one file.
 *
 * The checklist is stored as JSON on `QcInspection` (see the note on that model
 * in schema.prisma) so the groups can change without a migration. That trade
 * has a cost — a stored checklist is a snapshot of the questions asked *at the
 * time* — so `parseChecklist` renders whatever the row actually contains rather
 * than looping over today's constant and finding blanks.
 */

export type ChecklistGroup = {
  key: string;
  label: string;
  items: { label: string; ok: boolean }[];
};

/** Field name for one checklist item, shared by the form and the parser. */
export function checklistFieldName(groupKey: string, item: string): string {
  return `check.${groupKey}.${item}`;
}

/**
 * Read the posted checklist out of a FormData.
 *
 * Unchecked boxes post nothing at all, which is exactly why this iterates the
 * constant rather than the form: a group with every box unticked would
 * otherwise vanish from the record, and "not recorded" would be
 * indistinguishable from "inspected and failed".
 */
export function checklistFromFormData(
  formData: FormData,
): Record<string, Record<string, boolean>> {
  const result: Record<string, Record<string, boolean>> = {};

  for (const [groupKey, group] of Object.entries(QC_CHECKLIST)) {
    result[groupKey] = Object.fromEntries(
      group.items.map((item) => [
        item,
        formData.get(checklistFieldName(groupKey, item)) === "on",
      ]),
    );
  }

  return result;
}

/** How many boxes were ticked, out of how many were asked. */
export function checklistScore(
  checklist: Record<string, Record<string, boolean>>,
) {
  let passed = 0;
  let total = 0;
  for (const group of Object.values(checklist)) {
    for (const ok of Object.values(group)) {
      total += 1;
      if (ok) passed += 1;
    }
  }
  return { passed, total };
}

/**
 * Render a stored checklist. Never throws: a malformed row must not take out
 * the page that is trying to explain a rejection.
 */
export function parseChecklist(json: string): ChecklistGroup[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!raw || typeof raw !== "object") return [];

  return Object.entries(raw as Record<string, unknown>).map(([key, value]) => ({
    key,
    label:
      QC_CHECKLIST[key as keyof typeof QC_CHECKLIST]?.label ??
      key.charAt(0).toUpperCase() + key.slice(1),
    items:
      value && typeof value === "object"
        ? Object.entries(value as Record<string, unknown>).map(
            ([label, ok]) => ({ label, ok: ok === true }),
          )
        : [],
  }));
}

export function rejectionReasonLabel(code: string | null): string | null {
  if (!code) return null;
  return (
    QC_REJECTION_REASONS[code as keyof typeof QC_REJECTION_REASONS] ?? code
  );
}
