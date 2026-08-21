import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/context";
import { getSettingsByCategory } from "@/lib/admin/settings";
import { SettingsGroupForm } from "@/components/admin/settings-form";

export const metadata: Metadata = { title: "Settings" };

/**
 * Platform settings — SRS §87.
 *
 * Generated from the `Setting` table rather than hand-written per key, so the
 * screen cannot fall behind the data. Checkout reads these rows through
 * `src/lib/commerce/settings.ts`, which is why the GST, shipping, COD and
 * returns values here change what a customer is charged rather than only what
 * an admin sees.
 */
export default async function AdminSettingsPage() {
  await requireAdmin("/admin/settings");

  const groups = await getSettingsByCategory();

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <p className="eyebrow mb-2">Platform configuration</p>
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-400">
          Values marked <em>read at checkout</em> take effect on the next order
          placed. Each group saves on its own.
        </p>
      </header>

      <nav aria-label="Settings groups" className="mb-8">
        <ul className="flex flex-wrap gap-2">
          {groups.map((group) => (
            <li key={group.key}>
              <a
                href={`#settings-${group.key.toLowerCase()}`}
                className="inline-block rounded-md border border-ivory-400 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-ink-500 transition-colors hover:border-ink-400 hover:text-brand-600"
              >
                {group.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-6">
        {groups.map((group) => (
          <SettingsGroupForm
            key={group.key}
            category={group.key}
            label={group.label}
            blurb={group.blurb}
            settings={group.settings}
          />
        ))}
      </div>
    </div>
  );
}
