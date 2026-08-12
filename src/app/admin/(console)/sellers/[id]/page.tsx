import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, FileText, XCircle } from "lucide-react";
import { requireAdmin } from "@/lib/admin/context";
import { getSellerForReview } from "@/lib/admin/sellers";
import { kycChecklist, REQUIRED_DOCS } from "@/lib/seller/profile";
import {
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_TONE,
} from "@/lib/seller/product-status";
import {
  SELLER_BUSINESS_TYPE_LABEL,
  SELLER_DOC_LABEL,
  SELLER_VERIFICATION_LABEL,
} from "@/lib/constants";
import { DOC_STATUS_TONE, SELLER_STATUS_TONE } from "@/lib/status-tone";
import { formatDate, formatPaise } from "@/lib/utils";
import { StatusBadge } from "@/components/commerce/status-badge";
import {
  CommissionForm,
  KycDocumentReview,
  SellerVerificationActions,
} from "@/components/admin/seller-actions";

export const metadata: Metadata = { title: "Seller" };

/**
 * One seller's application and trading record — SRS §55, §74.
 *
 * The left column is the application as the seller submitted it; the right one
 * is the decision. Both read from `getSellerProfile()`, the same function
 * `/seller/pending` uses, so an admin can never be looking at a different set
 * of documents from the seller they are judging.
 */
export default async function AdminSellerDetailPage({
  params,
}: PageProps<"/admin/sellers/[id]">) {
  await requireAdmin("/admin/sellers");
  const { id } = await params;

  const data = await getSellerForReview(id);
  if (!data) notFound();

  const { profile, kyc, stats, recentProducts } = data;
  const rows = kycChecklist(profile.documents);
  const outstanding = rows
    .filter((row) => row.document?.status !== "APPROVED")
    .map((row) => SELLER_DOC_LABEL[row.docType] ?? row.docType);

  const detail: [string, string | null][] = [
    ["Owner", profile.ownerName],
    [
      "Business type",
      SELLER_BUSINESS_TYPE_LABEL[profile.businessType] ?? profile.businessType,
    ],
    ["GSTIN", profile.gstNumber],
    ["PAN", profile.panNumber],
    ["Email", profile.user.email],
    ["Mobile", profile.user.mobile],
    [
      "Business address",
      profile.addressLine
        ? `${profile.addressLine}, ${profile.city}, ${profile.state} ${profile.pinCode}`
        : null,
    ],
    ["Pickup address", profile.pickupAddress],
    ["Bank account name", profile.bankAccountName],
    ["Bank account", profile.bankAccountNumber],
    ["IFSC", profile.bankIfsc],
    ["Applied", formatDate(profile.createdAt)],
    ["Verified", profile.verifiedAt ? formatDate(profile.verifiedAt) : null],
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin/sellers"
        className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
      >
        ← All sellers
      </Link>

      <header className="mb-8 mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl">{profile.businessName}</h1>
          <StatusBadge
            label={
              SELLER_VERIFICATION_LABEL[profile.verificationStatus] ??
              profile.verificationStatus
            }
            tone={SELLER_STATUS_TONE[profile.verificationStatus] ?? "neutral"}
          />
        </div>
        {profile.description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
            {profile.description}
          </p>
        )}
      </header>

      {/* ---- Decision ---- */}
      <section className="mb-8 border border-ivory-400 bg-ivory-50 p-5">
        <p className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
          Verification decision
        </p>
        <SellerVerificationActions
          sellerId={profile.id}
          status={profile.verificationStatus}
          kycComplete={kyc.approved === REQUIRED_DOCS.length}
          outstandingDocs={outstanding}
        />
        {profile.verificationNote && (
          <p className="mt-4 border-t border-ivory-300 pt-4 text-xs leading-relaxed text-ink-500">
            <span className="font-medium uppercase tracking-[0.14em] text-ink-400">
              Current note —{" "}
            </span>
            {profile.verificationNote}
          </p>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-8">
          {/* ---- KYC ---- */}
          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-xl">KYC documents</h2>
              <p className="text-xs text-ink-400">
                {kyc.approved} of {kyc.total} approved
                {kyc.missing > 0 && ` · ${kyc.missing} not uploaded`}
              </p>
            </div>

            <ul className="border border-ivory-400 bg-ivory-50">
              {rows.map(({ docType, document }) => (
                <li
                  key={docType}
                  className="border-b border-ivory-300 px-5 py-4 last:border-b-0"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <span aria-hidden="true" className="mt-0.5 shrink-0">
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
                      {document ? (
                        <p className="mt-0.5 text-xs text-ink-400">
                          Uploaded {formatDate(document.uploadedAt)}
                          {document.reviewedAt &&
                            ` · reviewed ${formatDate(document.reviewedAt)}`}
                          {" · "}
                          {/* Uploads are not implemented in this build — the
                              seeded fileUrl is a path, and linking it would be
                              a dead link. The filename is shown instead. */}
                          <span className="text-ink-500">
                            {document.fileUrl.split("/").pop()}
                          </span>
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-ink-400">
                          The seller has not uploaded this yet.
                        </p>
                      )}
                      {document?.reviewNote && (
                        <p className="mt-1 text-xs leading-relaxed text-danger">
                          {document.reviewNote}
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
                  </div>

                  {document && (
                    <div className="mt-3 pl-7">
                      <KycDocumentReview
                        documentId={document.id}
                        docType={document.docType}
                        status={document.status}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* ---- Application detail ---- */}
          <section>
            <h2 className="mb-3 font-display text-xl">Business details</h2>
            <dl className="border border-ivory-400 bg-ivory-50">
              {detail.map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-wrap gap-x-6 gap-y-1 border-b border-ivory-300 px-5 py-3 last:border-b-0"
                >
                  <dt className="w-44 shrink-0 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
                    {label}
                  </dt>
                  <dd className="min-w-0 flex-1 text-sm text-ink-900">
                    {value ?? (
                      <span className="text-ink-400">Not supplied</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* ---- Catalogue ---- */}
          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-xl">Catalogue</h2>
              <Link
                href={`/admin/products?sellerId=${profile.id}`}
                className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:text-brand-600"
              >
                All {stats.productTotal} products →
              </Link>
            </div>

            {recentProducts.length === 0 ? (
              <div className="border border-ivory-400 bg-ivory-50 p-6 text-center text-sm text-ink-400">
                This seller has not listed anything yet.
              </div>
            ) : (
              <ul className="border border-ivory-400 bg-ivory-50">
                {recentProducts.map((product) => (
                  <li
                    key={product.id}
                    className="border-b border-ivory-300 last:border-b-0"
                  >
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-ivory-200"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-900">
                        {product.name}
                      </span>
                      <span className="text-xs text-ink-400">
                        {product.sku}
                      </span>
                      <span className="text-xs text-ink-500">
                        {formatPaise(product.priceEffective)}
                      </span>
                      <StatusBadge
                        label={
                          PRODUCT_STATUS_LABEL[product.status] ?? product.status
                        }
                        tone={PRODUCT_STATUS_TONE[product.status] ?? "neutral"}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ---- Trading record ---- */}
        <aside className="space-y-6">
          <section className="border border-ivory-400 bg-ivory-50 p-5">
            <p className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
              Trading record
            </p>
            <dl className="space-y-3 text-sm">
              {[
                ["Live products", String(stats.products.APPROVED)],
                ["Awaiting approval", String(stats.products.PENDING)],
                ["Orders received", String(stats.subOrders)],
                ["Delivered", String(stats.deliveredCount)],
                ["Gross delivered", formatPaise(stats.deliveredGross)],
                ["Awaiting payout", formatPaise(stats.settlementPending)],
                ["Paid out", formatPaise(stats.settlementReleased)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-ink-400">{label}</dt>
                  <dd className="text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="border border-ivory-400 bg-ivory-50 p-5">
            <p className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-400">
              Commission
            </p>
            <CommissionForm
              sellerId={profile.id}
              commissionPercent={profile.commissionPercent}
            />
            <p className="mt-3 text-xs leading-relaxed text-ink-400">
              Applies to settlements raised from now on. Payouts already
              calculated keep the rate they were charged at.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
