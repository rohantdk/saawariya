import type { PrismaClient } from "../../src/generated/prisma/client";
import {
  PERMISSIONS,
  PERMISSION_META,
  ROLE_PERMISSIONS,
} from "../../src/lib/auth/permissions";
import { ROLES, ROLE_LABEL, type RoleCode } from "../../src/lib/constants";

const ROLE_DESCRIPTIONS: Record<RoleCode, string> = {
  CUSTOMER: "Retail and wholesale buyers who browse, purchase and review products.",
  SELLER: "Verified textile businesses who list products and fulfil orders.",
  WAREHOUSE: "Receives orders, locates and picks stock, prepares items for inspection.",
  QC: "Inspects products against the quality checklist before dispatch.",
  LOGISTICS: "Assigns couriers, creates shipments and tracks delivery.",
  FINANCE: "Verifies payments, releases seller settlements and processes refunds.",
  SUPPORT: "Handles customer and seller tickets, returns and escalations.",
  MARKETING: "Runs campaigns, coupons, banners and platform communications.",
  SUPER_ADMIN: "Full platform governance and configuration.",
};

/**
 * Seeds the RBAC tables from the matrix in src/lib/auth/permissions.ts.
 *
 * The code constants remain the source of truth — these rows exist so the admin
 * Roles & Permissions screen (SRS §88) displays real data. Re-running is safe:
 * everything upserts, and grants are reconciled rather than duplicated.
 */
export async function seedRoles(prisma: PrismaClient) {
  for (const [code, meta] of Object.entries(PERMISSION_META)) {
    await prisma.permission.upsert({
      where: { code },
      update: { module: meta.module, description: meta.description },
      create: { code, module: meta.module, description: meta.description },
    });
  }

  for (const code of Object.values(ROLES)) {
    await prisma.role.upsert({
      where: { code },
      update: {
        name: ROLE_LABEL[code],
        description: ROLE_DESCRIPTIONS[code],
      },
      create: {
        code,
        name: ROLE_LABEL[code],
        description: ROLE_DESCRIPTIONS[code],
        isSystem: true,
      },
    });

    // Reconcile grants so a permission removed from the matrix is also revoked
    // in the database, not just left behind.
    await prisma.rolePermission.deleteMany({ where: { roleCode: code } });
    await prisma.rolePermission.createMany({
      data: ROLE_PERMISSIONS[code].map((permissionCode) => ({
        roleCode: code,
        permissionCode,
      })),
    });
  }

  console.log(
    `  Roles: ${Object.keys(ROLES).length}, ` +
      `Permissions: ${Object.keys(PERMISSIONS).length}`,
  );
}
