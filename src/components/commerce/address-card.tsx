"use client";

import { useActionState, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deleteAddress, setDefaultAddress } from "@/app/actions/address";
import { IDLE_STATE } from "@/lib/validations/commerce";
import { AddressForm, type AddressRecord } from "@/components/commerce/address-form";

/**
 * One saved address, with edit and delete in place.
 *
 * Editing swaps the card for the form rather than opening a dialog: there is
 * only ever one address being edited, the form is long enough that a modal
 * would scroll on a phone anyway, and nothing has to trap focus.
 */
export function AddressCard({ address }: { address: AddressRecord }) {
  const [editing, setEditing] = useState(false);

  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteAddress,
    IDLE_STATE,
  );
  const [defaultState, defaultAction, defaultPending] = useActionState(
    setDefaultAddress,
    IDLE_STATE,
  );

  if (editing) {
    return (
      <div className="border border-brand-600 bg-ivory-50 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-900">Edit address</h2>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-ink-400 underline underline-offset-2 hover:text-ink-900"
          >
            Cancel
          </button>
        </div>
        <AddressForm
          address={address}
          submitLabel="Save changes"
          onDone={() => setEditing(false)}
        />
      </div>
    );
  }

  const error =
    deleteState.status === "error"
      ? deleteState.message
      : defaultState.status === "error"
        ? defaultState.message
        : null;

  return (
    <div className="flex h-full flex-col border border-ivory-400 bg-ivory-50 p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="border border-ivory-400 px-1.5 py-0.5 text-[0.625rem] uppercase tracking-[0.1em] text-ink-400">
          {address.label}
        </span>
        {address.isDefaultShipping && (
          <span className="text-[0.625rem] uppercase tracking-[0.1em] text-brand-600">
            Default delivery
          </span>
        )}
        {address.isDefaultBilling && (
          <span className="text-[0.625rem] uppercase tracking-[0.1em] text-gold-500">
            Default billing
          </span>
        )}
      </div>

      <address className="text-sm not-italic leading-relaxed text-ink-500">
        <span className="block text-ink-900">{address.fullName}</span>
        {[address.line1, address.line2, address.landmark]
          .filter(Boolean)
          .map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        <span className="block">
          {address.city}, {address.state} {address.pinCode}
        </span>
        <span className="mt-1.5 block text-xs text-ink-400">
          {address.mobile}
        </span>
      </address>

      {error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 text-xs text-ink-400 transition-colors hover:text-brand-600"
        >
          <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
          Edit
        </button>

        {!address.isDefaultShipping && (
          <form action={defaultAction}>
            <input type="hidden" name="id" value={address.id} />
            <input type="hidden" name="kind" value="shipping" />
            <button
              type="submit"
              disabled={defaultPending}
              className="text-xs text-ink-400 transition-colors hover:text-brand-600 disabled:opacity-50"
            >
              Make default
            </button>
          </form>
        )}

        <form action={deleteAction} className="ml-auto">
          <input type="hidden" name="id" value={address.id} />
          <button
            type="submit"
            disabled={deletePending}
            className="inline-flex items-center gap-1.5 text-xs text-ink-400 transition-colors hover:text-danger disabled:opacity-50"
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            Delete
          </button>
        </form>
      </div>
    </div>
  );
}
