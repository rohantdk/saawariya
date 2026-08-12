import "server-only";
import { prisma } from "@/lib/prisma";
import { rejectionReasonLabel } from "@/lib/operations/checklist";
import { QC_RESULT, SUB_ORDER_STATUS as S } from "@/lib/constants";

/**
 * Quality control reads — SRS §99-104.
 *
 * The queues live in `queues.ts` with the other two desks'. What is here is
 * everything that reads `QcInspection`: the record of a verdict, which is the
 * only durable answer to "why did this parcel go back", and the reports built
 * from it.
 *
 * The pure checklist helpers are **not** here. They live in
 * `src/lib/operations/checklist.ts` because the inspection form is a Client
 * Component and this module imports `prisma` — see the note at the top of that
 * file for why that combination breaks the production build and nothing else.
 */

export const INSPECTIONS_PAGE_SIZE = 20;

export async function qcSummary() {
  const [pending, failed, repicking, inspections] = await Promise.all([
    prisma.subOrder.count({ where: { status: S.QC_PENDING } }),
    prisma.subOrder.count({ where: { status: S.QC_FAILED } }),
    prisma.subOrder.count({ where: { status: S.RETURNED_TO_WAREHOUSE } }),
    prisma.qcInspection.groupBy({ by: ["result"], _count: { _all: true } }),
  ]);

  const byResult = new Map(
    inspections.map((row) => [row.result, row._count._all]),
  );
  const passedCount = byResult.get(QC_RESULT.PASSED) ?? 0;
  const failedCount = byResult.get(QC_RESULT.FAILED) ?? 0;
  const total = passedCount + failedCount;

  return {
    pending,
    failed,
    repicking,
    inspected: total,
    // Rendered as "—" rather than 0% when nothing has been inspected: a 0% pass
    // rate and no inspections at all are very different things to read.
    passRate: total === 0 ? null : Math.round((passedCount / total) * 100),
  };
}

export async function listInspections(
  options: { result?: string; page?: number } = {},
) {
  const result = options.result;

  const where = result && result !== "all" ? { result } : {};

  const total = await prisma.qcInspection.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / INSPECTIONS_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount);

  const inspections = await prisma.qcInspection.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * INSPECTIONS_PAGE_SIZE,
    take: INSPECTIONS_PAGE_SIZE,
    select: {
      id: true,
      result: true,
      rejectionReason: true,
      notes: true,
      isReinspection: true,
      createdAt: true,
      inspector: { select: { fullName: true } },
      subOrder: {
        select: {
          subOrderNumber: true,
          status: true,
          seller: { select: { businessName: true } },
        },
      },
    },
  });

  return { inspections, total, page, pageCount };
}

/**
 * The QC report — SRS §103, §104.
 *
 * Aggregated in memory from one narrow projection rather than several
 * `groupBy` round trips, for the same reason the Phase 3 facet counts are: at
 * this volume one read and a loop is cheaper and far easier to keep correct
 * than five queries whose filters have to agree. A high-volume installation
 * wants a reporting table instead, and this is where it would go.
 */
export async function qcReport(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.qcInspection.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: {
      result: true,
      rejectionReason: true,
      isReinspection: true,
      createdAt: true,
      inspector: { select: { id: true, fullName: true } },
    },
  });

  const daily = new Map<string, { passed: number; failed: number }>();
  const reasons = new Map<string, number>();
  const inspectors = new Map<
    string,
    { name: string; passed: number; failed: number }
  >();
  let reinspections = 0;

  for (const row of rows) {
    const passed = row.result === QC_RESULT.PASSED;
    const day = row.createdAt.toISOString().slice(0, 10);

    const dayRow = daily.get(day) ?? { passed: 0, failed: 0 };
    if (passed) dayRow.passed += 1;
    else dayRow.failed += 1;
    daily.set(day, dayRow);

    if (!passed && row.rejectionReason) {
      reasons.set(
        row.rejectionReason,
        (reasons.get(row.rejectionReason) ?? 0) + 1,
      );
    }

    if (row.isReinspection) reinspections += 1;

    const key = row.inspector.id;
    const person = inspectors.get(key) ?? {
      name: row.inspector.fullName,
      passed: 0,
      failed: 0,
    };
    if (passed) person.passed += 1;
    else person.failed += 1;
    inspectors.set(key, person);
  }

  const passed = rows.filter((r) => r.result === QC_RESULT.PASSED).length;
  const failed = rows.length - passed;

  return {
    days,
    total: rows.length,
    passed,
    failed,
    reinspections,
    passRate: rows.length === 0 ? null : Math.round((passed / rows.length) * 100),
    daily: [...daily.entries()]
      .map(([day, counts]) => ({ day, ...counts }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    reasons: [...reasons.entries()]
      .map(([code, count]) => ({
        code,
        label: rejectionReasonLabel(code) ?? code,
        count,
      }))
      .sort((a, b) => b.count - a.count),
    inspectors: [...inspectors.values()].sort(
      (a, b) => b.passed + b.failed - (a.passed + a.failed),
    ),
  };
}
