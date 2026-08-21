"use client";

import { useActionState } from "react";
import { updateSettings } from "@/app/actions/admin-settings";
import {
  LIVE_COMMERCE_KEYS,
  PAISE_KEYS,
  type SettingRow,
} from "@/lib/admin/setting-meta";
import { SETTING_BOUNDS } from "@/lib/validations/admin";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { formatPaise } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FieldError, FormMessage, Input, Label } from "@/components/ui/field";

/**
 * One settings group — SRS §87.
 *
 * The control is chosen from the row's `valueType`, not from a per-key mapping,
 * so a setting added by a later migration renders correctly with no change
 * here. Values that checkout actually consults are flagged, because "GST on
 * textiles" and "Default page title" look identical in a key/value table and
 * are very different things to get wrong.
 */
export function SettingsGroupForm({
  category,
  label,
  blurb,
  settings,
}: {
  category: string;
  label: string;
  blurb: string;
  settings: SettingRow[];
}) {
  const [state, action, pending] = useActionState(updateSettings, IDLE_STATE);

  return (
    <form
      action={action}
      className="rounded-md border border-ivory-400 bg-ivory-50 p-5"
      id={`settings-${category.toLowerCase()}`}
    >
      <input type="hidden" name="category" value={category} />

      <div className="mb-5">
        <h2 className="font-display text-xl">{label}</h2>
        {blurb && (
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-400">
            {blurb}
          </p>
        )}
      </div>

      {state.message && (
        <div className="mb-5">
          <FormMessage tone={state.status === "error" ? "error" : "success"}>
            {state.message}
          </FormMessage>
        </div>
      )}

      <div className="space-y-5">
        {settings.map((setting) => {
          const isLive = LIVE_COMMERCE_KEYS.has(setting.key);
          const bounds = SETTING_BOUNDS[setting.key];
          const errors = state.errors?.[setting.key];

          if (setting.valueType === "BOOLEAN") {
            return (
              <div key={setting.key}>
                <label className="flex items-start gap-3 text-sm text-ink-900">
                  <input
                    type="checkbox"
                    name={setting.key}
                    defaultChecked={setting.value === "true"}
                    className="mt-0.5 h-4 w-4 accent-brand-600"
                  />
                  <span>
                    {setting.label}
                    <span className="mt-0.5 block text-xs text-ink-400">
                      {setting.key}
                      {isLive && " · read at checkout"}
                    </span>
                  </span>
                </label>
                <FieldError messages={errors} />
              </div>
            );
          }

          const isNumber = setting.valueType === "NUMBER";
          const isPaise = PAISE_KEYS.has(setting.key);

          return (
            <div key={setting.key} className="space-y-2">
              <Label htmlFor={setting.key}>{setting.label}</Label>
              <Input
                id={setting.key}
                name={setting.key}
                defaultValue={setting.value}
                type={isNumber ? "number" : "text"}
                min={bounds?.min}
                max={bounds?.max}
                step={isNumber ? 1 : undefined}
                invalid={Boolean(errors)}
                className="max-w-md"
              />
              <p className="text-xs text-ink-400">
                {setting.key}
                {isPaise && ` · currently ${formatPaise(Number(setting.value))}`}
                {bounds && ` · ${bounds.min}–${bounds.max}`}
                {isLive && " · read at checkout"}
              </p>
              <FieldError messages={errors} />
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : `Save ${label.toLowerCase()}`}
        </Button>
      </div>
    </form>
  );
}
