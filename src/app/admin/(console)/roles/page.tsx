import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { requireAdmin } from "@/lib/admin/context";
import { getRoleMatrix } from "@/lib/admin/roles";
import { ROLE_LABEL, type RoleCode } from "@/lib/constants";

export const metadata: Metadata = { title: "Roles & access" };

/**
 * The RBAC matrix — SRS §88.
 *
 * Read-only on purpose, and the page argues the case rather than leaving it
 * implicit: `src/lib/auth/permissions.ts` is what every check in the
 * application consults, so editable toggles here would change rows and change
 * nothing else. That is the definition of a fake screen, and this build does
 * not ship those.
 *
 * The drift panel is what makes the screen genuinely useful — it compares the
 * seeded rows against the constants and reports any disagreement.
 */
export default async function AdminRolesPage() {
  await requireAdmin("/admin/roles");

  const { roles, modules, drift, unseeded, totals } = await getRoleMatrix();

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">SRS §88 — Roles &amp; permissions</p>
        <h1 className="font-display text-3xl">Roles &amp; access</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          {totals.roles} roles, {totals.permissions} permissions,{" "}
          {totals.grants} grants. Nine role codes rather than the eleven
          subsections in SRS §16 — a visitor is the absence of a session, and
          wholesale is a tier on the customer role. The reasoning is in{" "}
          <span className="text-ink-500">docs/ROLES.md</span>.
        </p>
      </header>

      {/* ---- Why this screen is read-only ---- */}
      <section className="mb-8 border border-info/30 bg-info-soft p-5">
        <p className="mb-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-500">
          Why this matrix cannot be edited here
        </p>
        <p className="text-sm leading-relaxed text-ink-900">
          Authorisation runs against the matrix in{" "}
          <span className="font-medium">src/lib/auth/permissions.ts</span>, not
          against these rows — the proxy, the data access layer, every Server
          Action and the order state machine all read the constants. The table
          below is a seeded projection of them so this screen can show real
          data. A toggle here would change a row and change nothing about what
          anyone is allowed to do, so there is no toggle.
        </p>
      </section>

      {/* ---- Drift ---- */}
      {(drift.length > 0 || unseeded.length > 0) && (
        <section className="mb-8 border border-danger/30 bg-danger-soft p-5">
          <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-500">
            The seeded rows disagree with the code
          </p>
          <ul className="space-y-1 text-sm text-ink-900">
            {drift.map((row) => (
              <li key={`${row.roleCode}-${row.permissionCode}-${row.kind}`}>
                {row.kind === "MISSING_IN_DB"
                  ? `${row.roleCode} holds ${row.permissionCode} in code but not in the database.`
                  : `${row.roleCode} is granted ${row.permissionCode} in the database but not in code — it has no effect.`}
              </li>
            ))}
            {unseeded.map((code) => (
              <li key={code}>
                {code} exists in code but was never seeded as a Permission row.
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-ink-500">
            Re-run <span className="font-medium">npm run db:seed</span> to bring
            the projection back in line. Behaviour is unaffected either way —
            the code is authoritative.
          </p>
        </section>
      )}

      {drift.length === 0 && unseeded.length === 0 && (
        <p className="mb-8 text-sm text-success">
          The seeded permission rows match the code exactly.
        </p>
      )}

      {/* ---- Roles ---- */}
      <section className="mb-8">
        <h2 className="mb-3 font-display text-xl">Roles</h2>
        <ul className="border border-ivory-400 bg-ivory-50">
          {roles.map((role) => (
            <li
              key={role.code}
              className="flex flex-wrap items-center gap-4 border-b border-ivory-300 px-5 py-4 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-900">
                  {ROLE_LABEL[role.code as RoleCode] ?? role.name}
                  <span className="ml-2 text-xs text-ink-400">{role.code}</span>
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-400">
                  {role.description}
                </p>
                {role.holdsAll && (
                  <p className="mt-1 text-xs text-ink-500">
                    Granted every permission by construction, not by an
                    &ldquo;is admin&rdquo; bypass — so a new permission can
                    never end up held by nobody.
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right text-xs text-ink-400">
                <p>
                  {role.permissionCount} permission
                  {role.permissionCount === 1 ? "" : "s"}
                </p>
                <p className="mt-0.5">
                  {role.userCount} user{role.userCount === 1 ? "" : "s"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Matrix ---- */}
      <section>
        <h2 className="mb-3 font-display text-xl">Permission matrix</h2>
        {/* Wide table: scrolls inside its own container rather than pushing the
            page sideways on a phone. */}
        <div className="overflow-x-auto border border-ivory-400 bg-ivory-50">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ivory-400">
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-ivory-50 px-4 py-3 text-left text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-400"
                >
                  Permission
                </th>
                {roles.map((role) => (
                  <th
                    key={role.code}
                    scope="col"
                    className="px-2 py-3 text-center text-[0.625rem] font-medium uppercase tracking-[0.08em] text-ink-400"
                  >
                    {ROLE_LABEL[role.code as RoleCode] ?? role.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((group) => (
                <ModuleRows
                  key={group.module}
                  module={group.module}
                  permissions={group.permissions}
                  roleCodes={roles.map((role) => role.code)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-6 text-xs text-ink-400">
        Audit of who actually used these permissions is in the{" "}
        <Link
          href="/admin/audit"
          className="text-ink-500 underline-offset-4 hover:text-brand-600 hover:underline"
        >
          audit log
        </Link>
        .
      </p>
    </div>
  );
}

function ModuleRows({
  module,
  permissions,
  roleCodes,
}: {
  module: string;
  permissions: {
    code: string;
    description: string;
    roles: Record<string, boolean>;
  }[];
  roleCodes: string[];
}) {
  return (
    <>
      <tr className="border-b border-ivory-300 bg-ivory-200">
        <th
          scope="colgroup"
          colSpan={roleCodes.length + 1}
          className="sticky left-0 px-4 py-2 text-left text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-500"
        >
          {module}
        </th>
      </tr>
      {permissions.map((permission) => (
        <tr key={permission.code} className="border-b border-ivory-300">
          <th
            scope="row"
            className="sticky left-0 z-10 bg-ivory-50 px-4 py-2.5 text-left font-normal"
          >
            <span className="block text-sm text-ink-900">
              {permission.description}
            </span>
            <span className="block text-xs text-ink-400">
              {permission.code}
            </span>
          </th>
          {roleCodes.map((roleCode) => (
            <td key={roleCode} className="px-2 py-2.5 text-center">
              {permission.roles[roleCode] ? (
                <>
                  <Check
                    aria-hidden="true"
                    className="mx-auto h-4 w-4 text-success"
                  />
                  <span className="sr-only">Granted</span>
                </>
              ) : (
                <>
                  <Minus
                    aria-hidden="true"
                    className="mx-auto h-3 w-3 text-ink-400/40"
                  />
                  <span className="sr-only">Not granted</span>
                </>
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
