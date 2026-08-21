import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, FileText, XCircle } from "lucide-react";
import { requireSeller } from "@/lib/seller/context";
import {
  getSellerProfile,
  kycChecklist,
  kycProgress,
} from "@/lib/seller/profile";
import {
  SELLER_DOC_LABEL,
  SELLER_VERIFICATION_LABEL,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import { SellerProfileForm } from "@/components/seller/profile-form";
import type { Tone } from "@/lib/commerce/order-status";

export const metadata: Metadata = { title: "Business profile" };

const DOC_TONE: Record<string, Tone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

/**
 * Business profile and KYC — SRS §54, §57.
 *
 * An approved seller can edit their business details, address and bank account,
 * but not their verification status or commission rate — neither is a field on
 * the form and neither is ever written by `saveSellerProfile`, so a crafted POST
 * cannot reach them. Approval is an admin decision (SRS §75) and commission is a
 * commercial term (SRS §119).
 */
export default async function SellerProfilePage() {
  const seller = await requireSeller("/seller/profile");
  const profile = await getSellerProfile(seller.sellerId);
  if (!profile) notFound();

  const rows = kycChecklist(profile.documents);
  const progress = kycProgress(profile.documents);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <p className="eyebrow mb-2">Business profile</p>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl">{profile.businessName}</h1>
          <StatusBadge
            label={
              SELLER_VERIFICATION_LABEL[profile.verificationStatus] ??
              profile.verificationStatus
            }
            tone="success"
          />
        </div>
        <p className="text-sm text-ink-400">
          {profile.user.email}
          {profile.verifiedAt && ` · verified ${formatDate(profile.verifiedAt)}`}
        </p>
      </header>

      {/* ---- Commercial terms, read-only ---- */}
      <section className="mb-10 rounded-md border border-ivory-400 bg-ivory-50 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
              Commission rate
            </p>
            <p className="mt-1 font-display text-2xl text-ink-900">
              {profile.commissionPercent}%
            </p>
          </div>
          <p className="max-w-sm text-xs leading-relaxed text-ink-400">
            Charged on the order value of each delivered parcel, before any
            Saawariya-funded discount. Set by the platform — contact us to
            discuss your rate.
          </p>
        </div>
      </section>

      {/* ---- KYC ---- */}
      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-xl">KYC documents</h2>
          <p className="text-xs text-ink-400">
            {progress.approved} of {progress.total} approved
          </p>
        </div>

        <ul className="rounded-md border border-ivory-400 bg-ivory-50">
          {rows.map(({ docType, document }) => (
            <li
              key={docType}
              className="flex flex-wrap items-center gap-3 border-b border-ivory-300 px-5 py-4 last:border-b-0"
            >
              <span aria-hidden="true" className="shrink-0">
                {document?.status === "APPROVED" ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : document?.status === "REJECTED" ? (
                  <XCircle className="h-4 w-4 text-danger" />
                ) : document ? (
                  <Clock className="h-4 w-4 text-warning" />
                ) : (
                  <FileText className="h-4 w-4 text-ink-400" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-900">
                  {SELLER_DOC_LABEL[docType] ?? docType}
                </p>
                {document?.reviewNote && (
                  <p className="mt-0.5 text-xs leading-relaxed text-danger">
                    {document.reviewNote}
                  </p>
                )}
                {document && !document.reviewNote && (
                  <p className="mt-0.5 text-xs text-ink-400">
                    Uploaded {formatDate(document.uploadedAt)}
                  </p>
                )}
              </div>

              <StatusBadge
                label={document ? document.status : "Not uploaded"}
                tone={
                  document ? (DOC_TONE[document.status] ?? "neutral") : "neutral"
                }
              />
            </li>
          ))}
        </ul>

        {/* No upload control, and the page says why rather than showing a
            button that cannot work. File storage is out of scope for this
            build — see docs/DEMO_WALKTHROUGH.md. */}
        <p className="mt-3 text-xs leading-relaxed text-ink-400">
          Document uploads are handled by our onboarding team in this
          demonstration build; the records above are live and reflect what our
          verification team has reviewed.
        </p>
      </section>

      {/* ---- Editable details ---- */}
      <section>
        <h2 className="mb-1 font-display text-xl">Business details</h2>
        <p className="mb-6 text-xs leading-relaxed text-ink-400">
          Your pickup address is where our warehouse team collects stock. The
          bank account is where settlements are paid.
        </p>
        <SellerProfileForm profile={profile} submitLabel="Save changes" />
      </section>
    </div>
  );
}
