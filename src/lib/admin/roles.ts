import "server-only";
import { prisma } from "@/lib/prisma";
import {
  PERMISSIONS,
  PERMISSION_META,
  ROLE_PERMISSIONS,
  type Permission,
} from "@/lib/auth/permissions";
import { ROLES, type RoleCode } from "@/lib/constants";

/**
 * Roles and permissions — SRS §88.
 *
 * The matrix is **read-only, and the screen says why.**
 * `src/lib/auth/permissions.ts` is the single source of truth: every
 * authorisation check in the application — the proxy, the DAL, every Server
 * Action, the order state machine — runs against those constants, and the
 * Role / Permission / RolePermission tables are a seeded projection of them so
 * this screen can render real rows rather than a hardcoded list.
 *
 * Making the toggles writable would therefore ship the one thing this build
 * refuses to: a control that changes a database row and changes nothing else. A
 * permission the code does not know about cannot be granted by editing a row,
 * and a permission the code *does* check cannot be revoked by clearing one.
 *
 * What the screen does instead is **check the projection for drift.** If a
 * grant exists in code but not in the database, or vice versa, the seed and the
 * matrix have diverged — which is a real defect, and one nothing else would
 * ever surface.
 */

export type PermissionDrift = {
  roleCode: string;
  permissionCode: string;
  /** "MISSING_IN_DB" — code grants it, the table does not, and vice versa. */
  kind: "MISSING_IN_DB" | "EXTRA_IN_DB";
};

export async function getRoleMatrix() {
  const [roles, permissions, grants, userCounts] = await Promise.all([
    prisma.role.findMany({
      orderBy: { code: "asc" },
      select: { code: true, name: true, description: true, isSystem: true },
    }),
    prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { code: "asc" }],
      select: { code: true, module: true, description: true },
    }),
    prisma.rolePermission.findMany({
      select: { roleCode: true, permissionCode: true },
    }),
    prisma.user.groupBy({ by: ["roleCode"], _count: { _all: true } }),
  ]);

  const granted = new Set(
    grants.map((g) => `${g.roleCode}::${g.permissionCode}`),
  );
  const usersBy = new Map(userCounts.map((u) => [u.roleCode, u._count._all]));

  // ---- Drift between the seeded rows and the authoritative constants -------
  const drift: PermissionDrift[] = [];
  const allCodes = Object.values(PERMISSIONS) as Permission[];

  for (const role of roles) {
    const inCode = new Set(ROLE_PERMISSIONS[role.code as RoleCode] ?? []);
    for (const code of allCodes) {
      const codeGrants = inCode.has(code);
      const dbGrants = granted.has(`${role.code}::${code}`);
      if (codeGrants && !dbGrants) {
        drift.push({
          roleCode: role.code,
          permissionCode: code,
          kind: "MISSING_IN_DB",
        });
      } else if (!codeGrants && dbGrants) {
        drift.push({
          roleCode: role.code,
          permissionCode: code,
          kind: "EXTRA_IN_DB",
        });
      }
    }
  }

  // A permission defined in code that was never seeded at all would otherwise
  // be invisible here — the loop above only walks rows that exist.
  const seededCodes = new Set(permissions.map((p) => p.code));
  const unseeded = allCodes.filter((code) => !seededCodes.has(code));

  // Grouped by module, which is how the SRS lists them and how anyone reading
  // the matrix thinks about it.
  const modules = new Map<
    string,
    { code: string; description: string; roles: Record<string, boolean> }[]
  >();

  for (const permission of permissions) {
    const list = modules.get(permission.module) ?? [];
    list.push({
      code: permission.code,
      description: permission.description,
      roles: Object.fromEntries(
        roles.map((role) => [
          role.code,
          granted.has(`${role.code}::${permission.code}`),
        ]),
      ),
    });
    modules.set(permission.module, list);
  }

  return {
    roles: roles.map((role) => ({
      ...role,
      userCount: usersBy.get(role.code) ?? 0,
      permissionCount: grants.filter((g) => g.roleCode === role.code).length,
      /**
       * SUPER_ADMIN is granted every permission by construction rather than by
       * an `isAdmin` bypass, so that adding a permission cannot silently create
       * a capability nobody holds. Worth stating on the screen — a row with
       * every box ticked otherwise looks like an oversight.
       */
      holdsAll: role.code === ROLES.SUPER_ADMIN,
    })),
    modules: [...modules.entries()].map(([module, items]) => ({
      module,
      permissions: items.map((item) => ({
        ...item,
        meta: PERMISSION_META[item.code as Permission],
      })),
    })),
    drift,
    unseeded,
    totals: {
      roles: roles.length,
      permissions: permissions.length,
      grants: grants.length,
    },
  };
}
