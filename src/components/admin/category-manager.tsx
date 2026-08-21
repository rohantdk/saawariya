"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  deleteCategory,
  saveCategory,
  toggleCategoryActive,
} from "@/app/actions/admin-categories";
import type { CategoryTreeNode } from "@/lib/admin/categories";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FormMessage,
  Input,
  Label,
  Select,
} from "@/components/ui/field";

/**
 * The category tree and its editor — SRS §76.
 *
 * One client component rather than a page per category: the tree is 34 rows
 * and the thing an admin actually does is compare siblings and nudge one, which
 * a round trip per edit makes tedious. The editor is an inline panel, and the
 * row being edited stays visible above it.
 *
 * Every mutation is still a Server Action against a real form — the client
 * state here is only *which* row is open.
 */

type EditorTarget =
  | { mode: "create"; parentId: string | null }
  | { mode: "edit"; node: CategoryTreeNode; parentId: string | null }
  | null;

export function CategoryManager({
  tree,
  parents,
}: {
  tree: CategoryTreeNode[];
  parents: { id: string; name: string }[];
}) {
  const [target, setTarget] = useState<EditorTarget>(null);
  const [saveState, saveAction, saving] = useActionState(
    saveCategory,
    IDLE_STATE,
  );

  return (
    <div className="space-y-6">
      {saveState.message && (
        <FormMessage tone={saveState.status === "error" ? "error" : "success"}>
          {saveState.message}
        </FormMessage>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          size="sm"
          onClick={() => setTarget({ mode: "create", parentId: null })}
        >
          New top-level category
        </Button>
        {parents.length > 0 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setTarget({ mode: "create", parentId: parents[0].id })
            }
          >
            New sub-category
          </Button>
        )}
      </div>

      {target && (
        <CategoryEditor
          key={target.mode === "edit" ? target.node.id : "new"}
          target={target}
          parents={parents}
          action={saveAction}
          saving={saving}
          errors={saveState.errors}
          onClose={() => setTarget(null)}
        />
      )}

      <ul className="space-y-3">
        {tree.map((parent) => (
          <li
            key={parent.id}
            className="rounded-md border border-ivory-400 bg-ivory-50"
          >
            <CategoryRow
              node={parent}
              depth={0}
              onEdit={() =>
                setTarget({ mode: "edit", node: parent, parentId: null })
              }
            />

            {parent.children.length > 0 && (
              <ul className="border-t border-ivory-300">
                {parent.children.map((child) => (
                  <li
                    key={child.id}
                    className="border-b border-ivory-300 last:border-b-0"
                  >
                    <CategoryRow
                      node={child}
                      depth={1}
                      onEdit={() =>
                        setTarget({
                          mode: "edit",
                          node: child,
                          parentId: parent.id,
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryRow({
  node,
  depth,
  onEdit,
}: {
  node: CategoryTreeNode;
  depth: number;
  onEdit: () => void;
}) {
  const [toggleState, toggleAction, toggling] = useActionState(
    toggleCategoryActive,
    IDLE_STATE,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteCategory,
    IDLE_STATE,
  );

  // Rendered from the row's own action state. Reporting it upward would mean
  // setting a parent's state during this component's render, which React 19
  // rightly refuses.
  const result =
    deleteState.status !== "idle"
      ? deleteState
      : toggleState.status !== "idle"
        ? toggleState
        : null;

  const canDelete = node.productCount === 0 && node.children.length === 0;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 px-5 py-4 ${
        depth > 0 ? "pl-10" : ""
      } ${node.isActive ? "" : "opacity-60"}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-900">
          {node.name}
          {!node.isActive && (
            <span className="ml-2 text-xs uppercase tracking-[0.1em] text-ink-400">
              Hidden
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-ink-400">
          /shop/{node.slug} · {node.productCount} product
          {node.productCount === 1 ? "" : "s"} · {node.liveCount} live · sort{" "}
          {node.sortOrder}
        </p>
        {result?.message && (
          <p
            role={result.status === "error" ? "alert" : "status"}
            className={`mt-1.5 text-xs leading-relaxed ${
              result.status === "error" ? "text-danger" : "text-success"
            }`}
          >
            {result.message}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {/* Both levels resolve: /shop/[slug] canonical-redirects a sub-category
            to its nested path (Phase 3). */}
        {node.liveCount > 0 && node.isActive && (
          <Link
            href={`/shop/${node.slug}`}
            className="text-xs font-medium uppercase tracking-[0.12em] text-ink-400 transition-colors hover:text-brand-600"
          >
            View
          </Link>
        )}

        <Button size="sm" variant="ghost" onClick={onEdit}>
          Edit
        </Button>

        <form action={toggleAction}>
          <input type="hidden" name="id" value={node.id} />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={toggling}
          >
            {toggling ? "…" : node.isActive ? "Hide" : "Show"}
          </Button>
        </form>

        {canDelete && (
          <form action={deleteAction}>
            <input type="hidden" name="id" value={node.id} />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              disabled={deleting}
              className="text-danger"
            >
              {deleting ? "…" : "Delete"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function CategoryEditor({
  target,
  parents,
  action,
  saving,
  errors,
  onClose,
}: {
  target: NonNullable<EditorTarget>;
  parents: { id: string; name: string }[];
  action: (formData: FormData) => void;
  saving: boolean;
  errors?: Record<string, string[]>;
  onClose: () => void;
}) {
  const node = target.mode === "edit" ? target.node : null;
  const isChild = target.parentId !== null;

  return (
    <form
      action={action}
      className="space-y-5 rounded-md border border-brand-600/30 bg-ivory-50 p-5"
    >
      {node && <input type="hidden" name="id" value={node.id} />}

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-xl">
          {node ? `Edit ${node.name}` : isChild ? "New sub-category" : "New category"}
        </h2>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="cat-name" errors={errors?.name}>
          <Input
            id="cat-name"
            name="name"
            defaultValue={node?.name ?? ""}
            required
            maxLength={60}
            invalid={Boolean(errors?.name)}
          />
        </Field>

        <Field
          label="URL slug"
          htmlFor="cat-slug"
          errors={errors?.slug}
          hint={
            node
              ? "Leave blank to keep the current URL. Changing it breaks existing links."
              : "Leave blank to derive it from the name."
          }
        >
          <Input
            id="cat-slug"
            name="slug"
            defaultValue=""
            placeholder={node?.slug ?? "auto"}
            maxLength={80}
            invalid={Boolean(errors?.slug)}
          />
        </Field>

        <Field label="Parent" htmlFor="cat-parent" errors={errors?.parentId}>
          <Select
            id="cat-parent"
            name="parentId"
            defaultValue={target.parentId ?? ""}
            invalid={Boolean(errors?.parentId)}
          >
            <option value="">Top level</option>
            {parents
              .filter((parent) => parent.id !== node?.id)
              .map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))}
          </Select>
        </Field>

        <Field
          label="Sort order"
          htmlFor="cat-sort"
          errors={errors?.sortOrder}
          hint="Lower numbers appear first."
        >
          <Input
            id="cat-sort"
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            defaultValue={node?.sortOrder ?? 0}
          />
        </Field>

        <Field
          label="Image URL"
          htmlFor="cat-image"
          errors={errors?.imageUrl}
          className="sm:col-span-2"
          hint="A path under /public, e.g. /catalogue/sarees-01.jpg"
        >
          <Input
            id="cat-image"
            name="imageUrl"
            defaultValue={node?.imageUrl ?? ""}
            maxLength={300}
          />
        </Field>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="cat-description">Description</Label>
          <textarea
            id="cat-description"
            name="description"
            rows={2}
            maxLength={300}
            defaultValue={node?.description ?? ""}
            className="w-full border border-ivory-400 bg-ivory-50 px-4 py-3 text-sm text-ink-900 placeholder:text-ink-400/60 focus:border-brand-600 focus:outline-none"
          />
          <FieldError messages={errors?.description} />
        </div>
      </div>

      <label className="flex items-center gap-2.5 text-sm text-ink-900">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={node ? node.isActive : true}
          className="h-4 w-4 accent-brand-600"
        />
        Visible on the storefront
      </label>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : node ? "Save changes" : "Create category"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
