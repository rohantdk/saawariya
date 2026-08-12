"use client";

import { useActionState } from "react";
import { saveCmsPage } from "@/app/actions/marketing";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";

/**
 * Edit one content page — SRS §84.
 *
 * The body is raw HTML in a textarea rather than a rich-text editor. That is a
 * deliberate trade: a WYSIWYG editor is a large dependency and a large surface,
 * and the seeded pages are already HTML that the storefront renders directly.
 * A half-working editor that mangled the existing markup would be worse than
 * none, so the field says what it takes.
 *
 * The slug is shown but not editable. These pages are linked from the footer,
 * the login screen and seeded banners; renaming one would 404 every link
 * without anything reporting it.
 */
export function CmsPageForm({
  page,
}: {
  page: {
    id: string;
    slug: string;
    title: string;
    bodyHtml: string;
    metaTitle: string | null;
    metaDescription: string | null;
    isPublished: boolean;
    linkedFrom: string | null;
  };
}) {
  const [state, action, pending] = useActionState(saveCmsPage, IDLE_STATE);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={page.id} />

      {state.message && (
        <FormMessage tone={state.status === "error" ? "error" : "success"}>
          {state.message}
        </FormMessage>
      )}

      <Field
        label="Title"
        htmlFor="title"
        errors={state.errors?.title}
        hint={`Lives at /page/${page.slug} — the address cannot be changed, because other pages link to it.`}
      >
        <Input
          id="title"
          name="title"
          defaultValue={page.title}
          required
          maxLength={120}
          invalid={Boolean(state.errors?.title)}
        />
      </Field>

      <Field
        label="Content (HTML)"
        htmlFor="bodyHtml"
        errors={state.errors?.bodyHtml}
        hint="Rendered as written. Headings, paragraphs and lists — the storefront styles them."
      >
        <textarea
          id="bodyHtml"
          name="bodyHtml"
          rows={18}
          required
          defaultValue={page.bodyHtml}
          className="w-full border border-ivory-400 bg-ivory-50 px-4 py-3 font-mono text-xs leading-relaxed text-ink-900 focus:border-brand-600 focus:outline-none"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Search title"
          htmlFor="metaTitle"
          errors={state.errors?.metaTitle}
          hint="Optional. Falls back to the title above."
        >
          <Input
            id="metaTitle"
            name="metaTitle"
            defaultValue={page.metaTitle ?? ""}
            maxLength={70}
          />
        </Field>

        <Field
          label="Search description"
          htmlFor="metaDescription"
          errors={state.errors?.metaDescription}
          hint="Optional. Around 150 characters reads best."
        >
          <Input
            id="metaDescription"
            name="metaDescription"
            defaultValue={page.metaDescription ?? ""}
            maxLength={180}
          />
        </Field>
      </div>

      <div>
        {/*
          A disabled control posts nothing at all, so a linked page would submit
          with `isPublished` absent — read as "unpublish" — and the server would
          then refuse the save every time. The hidden input carries the value the
          disabled checkbox is displaying.
        */}
        {page.linkedFrom && (
          <input type="hidden" name="isPublished" value="on" />
        )}
        <label className="flex items-center gap-3 text-sm text-ink-900">
          <input
            type="checkbox"
            name={page.linkedFrom ? undefined : "isPublished"}
            defaultChecked={page.isPublished}
            disabled={Boolean(page.linkedFrom)}
            className="h-4 w-4 accent-brand-600"
          />
          Published — visible at /page/{page.slug}
        </label>
        {page.linkedFrom && (
          <p className="mt-1.5 text-xs text-ink-400">
            Linked from {page.linkedFrom}, so it cannot be unpublished — that
            would leave those links pointing at a 404.
          </p>
        )}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save page"}
      </Button>
    </form>
  );
}
