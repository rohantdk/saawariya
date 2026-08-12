import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, FileText, XCircle } from "lucide-react";
import { requireSellerAccount } from "@/lib/seller/context";
import { getSellerProfile, kycChecklist, kycProgress } from "@/lib/seller/profile";
import { PanelShell } from "@/components/layout/panel-shell";
import { StatusBadge } from "@/components/commerce/status-badge";
import { ButtonLink } from "@/components/ui/button";
import {
  SELLER_DOC_LABEL,
  SELLER_VERIFICATION,
  SELLER_VERIFICATION_LABEL,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { DOC_STATUS_TONE, SELLER_STATUS_TONE } from "@/lib/status-tone";

export const metadata: Metadata = { title: "Application status" };

/**
 * Where an unapproved seller lands — SRS §55.
 *
 * Deliberately outside the `(panel)` route group: it has no sidebar, because
 * every item in that sidebar is a screen this seller is not yet allowed to open,
 * and a navigation full of links that bounce you back here is worse than none.
 *
 * The page tells them three things a status word alone cannot: which documents
 * are outstanding, why anything was rejected, and what happens next.
 */
export default async function SellerPendingPage() {
  const seller = await requireSellerAccount("/seller/pending");

  // An approved seller has no business here — send them to the real panel
  // rather than showing them a "your application is being reviewed" page.
  if (seller.verificationStatus === SELLER_VERIFICATION.APPROVED) {
    redirect("/seller");
  }

  const profile = await getSellerProfile(seller.sellerId);
  if (!profile) redirect("/seller/onboarding");

  const rows = kycChecklist(profile.documents);
  const progress = kycProgress(profile.documents);
  const isRejected =
    profile.verificationStatus === SELLER_VERIFICATION.REJECTED ||
    profile.verificationStatus === SELLER_VERIFICATION.SUSPENDED;

  return (
    <PanelShell user={seller.user}>
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow mb-5">SRS §55 — Seller verification</p>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl">{profile.businessName}</h1>
          <StatusBadge
            label={
              SELLER_VERIFICATION_LABEL[profile.verificationStatus] ??
              profile.verificationStatus
            }
            tone={SELLER_STATUS_TONE[profile.verificationStatus] ?? "neutral"}
          />
        </div>

        <p className="mb-8 max-w-xl text-sm leading-relaxed text-ink-400">
          {isRejected
            ? "Your application was not approved. The reason is below — correct the listed items and our team will take another look."
            : "Your application is with our verification team. You can sell on Saawariya as soon as all four documents are approved."}
        </p>

        {profile.verificationNote && (
          <div
            className={`mb-8 border p-5 ${
              isRejected
                ? "border-danger/30 bg-danger-soft"
                : "border-info/30 bg-info-soft"
            }`}
          >
            <p className="mb-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-500">
              Note from the verification team
            </p>
            <p className="text-sm leading-relaxed text-ink-900">
              {profile.verificationNote}
            </p>
          </div>
        )}

        <div className="mb-8 border border-ivory-400 bg-ivory-50">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ivory-400 px-5 py-4">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
              KYC documents
            </p>
            <p className="text-xs text-ink-500">
              {progress.approved} of {progress.total} approved
            </p>
          </div>

          <ul>
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
                    document
                      ? (DOC_STATUS_TONE[document.status] ?? "neutral")
                      : "neutral"
                  }
                />
              </li>
            ))}
          </ul>
        </div>

        {/* Deliberately /seller/onboarding, not /seller/profile: profile lives
            inside the (panel) group, which this seller is gated out of, so that
            link would bounce them straight back to this page. Onboarding is the
            application form and doubles as "edit my application". */}
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/seller/onboarding" variant="secondary">
            Edit business details
          </ButtonLink>
          <ButtonLink href="/page/contact-us" variant="ghost">
            Contact support
          </ButtonLink>
        </div>
      </div>
    </PanelShell>
  );
}
