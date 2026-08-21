import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/commerce/context";
import { AddressForm } from "@/components/commerce/address-form";
import { AddressCard } from "@/components/commerce/address-card";

export const metadata: Metadata = { title: "My addresses" };

/**
 * Address book — SRS §38.
 *
 * Orders keep their own snapshot of the address they shipped to, so editing or
 * deleting a row here never rewrites history on a past order. That is the whole
 * reason Order carries `shipLine1`, `shipCity` and the rest rather than a
 * foreign key.
 */
export default async function AddressesPage() {
  const customer = await requireCustomer("/account/addresses");

  const addresses = await prisma.address.findMany({
    where: { userId: customer.userId },
    orderBy: [{ isDefaultShipping: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl sm:text-4xl">My addresses</h1>
      <p className="mt-2 text-sm text-ink-400">
        {addresses.length === 0
          ? "Add an address to speed up checkout."
          : `${addresses.length} saved address${addresses.length === 1 ? "" : "es"}. Past orders keep the address they were shipped to.`}
      </p>

      {addresses.length === 0 ? (
        <div className="mt-8 rounded-md border border-ivory-400 bg-ivory-50 p-6">
          <span
            aria-hidden="true"
            className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-ivory-200 text-ink-400"
          >
            <MapPin className="h-4 w-4" />
          </span>
          <AddressForm submitLabel="Save address" />
        </div>
      ) : (
        <>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {addresses.map((address) => (
              <li key={address.id}>
                <AddressCard address={address} />
              </li>
            ))}
          </ul>

          <details className="mt-6 rounded-md border border-ivory-400 bg-ivory-50">
            <summary className="cursor-pointer p-4 text-sm font-medium text-ink-900 transition-colors hover:text-brand-600">
              Add another address
            </summary>
            <div className="border-t border-ivory-400 p-5">
              <AddressForm />
            </div>
          </details>
        </>
      )}
    </div>
  );
}
