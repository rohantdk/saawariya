import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { requireCustomer } from "@/lib/commerce/context";
import { CUSTOMER_TYPE } from "@/lib/constants";
import {
  PasswordForm,
  ProfileForm,
  WholesaleForm,
} from "@/components/commerce/settings-forms";

export const metadata: Metadata = { title: "Account settings" };

/**
 * Profile, password and account tier — SRS §38, §50.
 *
 * Email is displayed but not editable. It is the account's identity and the
 * login credential, so changing it needs a verification round-trip through the
 * OtpCode table rather than a text field — that belongs with the rest of the
 * verification work, and a field that silently fails would be worse than an
 * honest read-only value.
 */
export default async function SettingsPage() {
  const customer = await requireCustomer("/account/settings");

  const record = await prisma.customer.findUnique({
    where: { id: customer.customerId },
    select: {
      customerType: true,
      gstNumber: true,
      dateOfBirth: true,
      preferredLang: true,
      createdAt: true,
      user: {
        select: {
          fullName: true,
          email: true,
          mobile: true,
          emailVerified: true,
          mobileVerified: true,
        },
      },
    },
  });

  if (!record) return null;

  const isWholesale = record.customerType === CUSTOMER_TYPE.WHOLESALE;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl sm:text-4xl">Account settings</h1>
      <p className="mt-2 text-sm text-ink-400">
        Member since {formatDate(record.createdAt)}.
      </p>

      {/* ---- Profile ---- */}
      <section className="mt-8 rounded-md border border-ivory-400 bg-ivory-50 p-6">
        <h2 className="mb-1 font-display text-xl">Your details</h2>
        <p className="mb-5 text-sm text-ink-400">
          Signed in as {record.user.email}
          {record.user.emailVerified && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-success">
              <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
              verified
            </span>
          )}
        </p>

        <ProfileForm
          defaults={{
            fullName: record.user.fullName,
            mobile: record.user.mobile ?? "",
            dateOfBirth: record.dateOfBirth
              ? record.dateOfBirth.toISOString().slice(0, 10)
              : "",
            preferredLang: record.preferredLang,
          }}
          mobileVerified={record.user.mobileVerified}
        />
      </section>

      {/* ---- Account tier ---- */}
      <section className="mt-6 rounded-md border border-ivory-400 bg-ivory-50 p-6">
        <h2 className="mb-1 font-display text-xl">
          {isWholesale ? "Wholesale account" : "Buying for a business?"}
        </h2>

        {isWholesale ? (
          <>
            <p className="text-sm leading-relaxed text-ink-400">
              Trade pricing is active on your account. Minimum order quantities
              apply on some pieces, and your GSTIN appears on every invoice.
            </p>
            <dl className="mt-4 border-t border-ivory-300 pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">GSTIN</dt>
                <dd className="text-ink-900">{record.gstNumber}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-ink-400">
              To change your GSTIN,{" "}
              <Link
                href="/account/support/new"
                className="text-brand-600 underline underline-offset-2"
              >
                raise a support request
              </Link>{" "}
              — we verify it against the order history before switching it.
            </p>
          </>
        ) : (
          <>
            <p className="mb-5 text-sm leading-relaxed text-ink-400">
              Add your GSTIN to unlock trade pricing across the catalogue.
              Wholesale orders carry minimum quantities and are invoiced with
              GST broken out.
            </p>
            <WholesaleForm />
          </>
        )}
      </section>

      {/* ---- Password ---- */}
      <section className="mt-6 rounded-md border border-ivory-400 bg-ivory-50 p-6">
        <h2 className="mb-1 font-display text-xl">Password</h2>
        <p className="mb-5 text-sm text-ink-400">
          Use at least 8 characters, with a letter and a number.
        </p>
        <PasswordForm />
      </section>
    </div>
  );
}
