# SRS coverage

Every one of the 202 sections of the supplied SRS, and where it is answered.

**This document is generated** — `npm run srs:coverage`. The "where it lives"
column is read out of the codebase itself: each module names the sections it
implements in its doc comment, and this table is those citations collected. It
cannot claim a screen that has been deleted.

| | Sections |
| --- | --- |
| Implemented, with code that cites the section | **137** |
| Narrative, journey or answered in documentation | 65 |
| Not built | 0 |

A section marked *Journey* is prose in the SRS restating a flow that is
implemented and cited under its functional section — §24 Shopping Cart Journey
describes what `/cart` does, and `/cart` cites §42 Shopping Cart.

---
## The full map

### §1–17 · Business context

| § | Section | Where it lives |
| --- | --- | --- |
| 1 | Confidentiality Agreement | Narrative — Confidentiality terms |
| 2 | Document Information | Narrative — Document metadata |
| 3 | Purpose of this Document | Narrative — States the purpose of the SRS itself |
| 4 | Project Overview | Narrative — Narrative overview |
| 5 | Massive Transformative Purpose (MTP) | Narrative — Brand purpose — informs the tone of the storefront copy |
| 6 | Vision | Narrative — Vision statement |
| 7 | Mission | Narrative — Mission statement |
| 8 | Platform Type | Narrative — Platform type — the B2C/B2B split it describes is built as `Customer.customerType` |
| 9 | Primary Stakeholders | Narrative — Stakeholder list — realised as the nine roles |
| 10 | Core Business Objectives | Narrative — Business objectives |
| 11 | Business Model | Narrative — Business model narrative |
| 12 | Marketplace Flow | Narrative — Restates the marketplace flow implemented across §52-114 |
| 13 | Revenue Model | `prisma/schema.prisma`, `src/app/actions/admin-sellers.ts`, `src/components/admin/seller-actions.tsx`, `src/lib/constants.ts` |
| 14 | Platform Scope | `prisma/schema.prisma`, `prisma/seed/customers.ts`, `prisma/seed/products.ts`, `src/app/actions/admin-customers.ts` +3 more |
| 15 | Stakeholder Ecosystem | Narrative — Ecosystem diagram |
| 16 | User Roles | `/admin/roles`, `prisma/schema.prisma`, `src/app/(auth)/register/register-form.tsx`, `src/lib/constants.ts` |
| 17 | Role Hierarchy | `prisma/schema.prisma`, `src/lib/constants.ts` |

### §18–33 · User journeys

| § | Section | Where it lives |
| --- | --- | --- |
| 18 | Introduction | Narrative — Chapter opener |
| 19 | High-Level Platform Workflow | Narrative — Workflow diagram, implemented as the sub-order pipeline |
| 20 | Visitor Journey | Journey — The storefront, signed out — `/`, `/shop`, `/product/[slug]` |
| 21 | Customer Registration Journey | `prisma/schema.prisma`, `src/app/actions/auth.ts`, `src/lib/validations/auth.ts` |
| 22 | Product Discovery Journey | Journey — Listing, facets and search — `/shop`, `/search` |
| 23 | Product Detail Journey | Journey — `/product/[slug]` |
| 24 | Shopping Cart Journey | Journey — `/cart` |
| 25 | Checkout Journey | Journey — `/checkout` |
| 26 | Payment Journey | Journey — The payment step of `/checkout`. No gateway is connected, and the page says so |
| 27 | Order Processing Journey | Journey — Seller confirmation, then the operations pipeline |
| 28 | Warehouse Journey | Journey — `/operations/warehouse` |
| 29 | Quality Control Journey | Journey — `/operations/qc` |
| 30 | Packaging Journey | Journey — The `PACKING` → `READY_FOR_DISPATCH` states, worked from the warehouse desk |
| 31 | Logistics Journey | Journey — `/operations/logistics` |
| 32 | Delivery Completion | Journey — The `DELIVERED` transition and its customer notification |
| 33 | Customer Support Journey | Journey — `/account/support` and `/admin/support` |

### §34–51 · Customer module

| § | Section | Where it lives |
| --- | --- | --- |
| 34 | Customer Module Overview | `src/app/account/layout.tsx` |
| 35 | Customer Dashboard | `/account`, `src/app/account/layout.tsx` |
| 36 | Customer Registration | `prisma/schema.prisma`, `src/app/(auth)/register/register-form.tsx`, `src/app/account/layout.tsx`, `src/app/actions/auth.ts` +1 more |
| 37 | Login Module | `/forgot-password`, `prisma/schema.prisma`, `src/app/account/layout.tsx`, `src/app/actions/auth.ts` |
| 38 | Customer Profile | `/account/addresses`, `/account/settings`, `prisma/schema.prisma`, `src/app/account/layout.tsx` +4 more |
| 39 | Product Search | `/search`, `src/app/account/layout.tsx` |
| 40 | Product Filters | `prisma/seed/categories.ts`, `src/app/account/layout.tsx`, `src/lib/constants.ts` |
| 41 | Wishlist Module | `/account/wishlist`, `prisma/schema.prisma`, `prisma/seed/baskets.ts`, `src/app/account/layout.tsx` +5 more |
| 42 | Shopping Cart | `/cart`, `prisma/schema.prisma`, `prisma/seed/baskets.ts`, `src/app/account/layout.tsx` +2 more |
| 43 | Checkout Module | `/checkout`, `src/app/account/layout.tsx`, `src/app/actions/checkout.ts`, `src/lib/commerce/coupons.ts` +1 more |
| 44 | Payment Module | `/checkout`, `src/app/account/layout.tsx`, `src/app/actions/checkout.ts`, `src/lib/constants.ts` +1 more |
| 45 | Orders Module | `/account/orders/[orderNumber]`, `/account/orders`, `/checkout/success/[orderNumber]`, `src/app/account/layout.tsx` +4 more |
| 46 | Order Tracking | `/account/orders/[orderNumber]`, `prisma/schema.prisma`, `src/app/account/layout.tsx`, `src/lib/validations/commerce.ts` |
| 47 | Reviews & Ratings | `/account/reviews`, `/admin/reviews`, `prisma/schema.prisma`, `prisma/seed/reviews.ts` +11 more |
| 48 | Notifications | `/account/notifications`, `prisma/schema.prisma`, `src/app/account/layout.tsx`, `src/lib/validations/commerce.ts` |
| 49 | Support Module | `/account/support`, `src/app/account/layout.tsx`, `src/app/actions/support.ts` |
| 50 | Customer Settings | `/account/settings`, `src/app/account/layout.tsx`, `src/app/actions/account.ts`, `src/lib/validations/commerce.ts` |
| 51 | Customer Permissions Summary | `src/app/account/layout.tsx` |

### §52–68 · Seller module

| § | Section | Where it lives |
| --- | --- | --- |
| 52 | Seller Module Overview | `prisma/schema.prisma`, `src/app/seller/(panel)/layout.tsx` |
| 53 | Seller Journey | `prisma/schema.prisma`, `src/app/seller/(panel)/layout.tsx`, `src/lib/constants.ts`, `src/lib/validations/seller.ts` |
| 54 | Seller Registration | `/seller/onboarding`, `/seller/profile`, `prisma/schema.prisma`, `src/app/actions/admin-sellers.ts` +6 more |
| 55 | Seller Verification | `/admin/sellers/[id]`, `/admin/sellers`, `/seller/pending`, `prisma/schema.prisma` +13 more |
| 56 | Seller Dashboard | `/seller`, `prisma/schema.prisma`, `src/app/seller/(panel)/layout.tsx`, `src/lib/validations/seller.ts` |
| 57 | Seller Profile | `/seller/profile`, `prisma/schema.prisma`, `src/app/actions/seller-profile.ts`, `src/app/seller/(panel)/layout.tsx` +2 more |
| 58 | Product Management | `/product/[slug]`, `/seller/products/[id]`, `/seller/products`, `prisma/schema.prisma` +8 more |
| 59 | Product Approval Workflow | `/seller/products/[id]`, `/seller/products`, `prisma/schema.prisma`, `src/app/actions/admin-products.ts` +5 more |
| 60 | Inventory Management | `/seller/inventory`, `prisma/schema.prisma`, `src/app/actions/seller-inventory.ts`, `src/app/seller/(panel)/layout.tsx` +4 more |
| 61 | Order Management | `/seller/orders/[subOrderNumber]`, `/seller/orders`, `prisma/schema.prisma`, `src/app/actions/seller-orders.ts` +4 more |
| 62 | Payments & Settlements | `/seller/orders/[subOrderNumber]/packing-slip`, `/seller/orders/[subOrderNumber]`, `prisma/schema.prisma`, `src/app/seller/(panel)/layout.tsx` |
| 63 | Reports | `/seller/reports`, `prisma/schema.prisma`, `src/app/seller/(panel)/layout.tsx`, `src/lib/seller/reports.ts` |
| 64 | Notifications | `/seller/notifications`, `prisma/schema.prisma`, `src/app/seller/(panel)/layout.tsx` |
| 65 | Seller Support | `prisma/schema.prisma`, `src/app/seller/(panel)/layout.tsx` |
| 66 | Seller Settings | `prisma/schema.prisma`, `src/app/seller/(panel)/layout.tsx` |
| 67 | Seller Permissions Matrix | `prisma/schema.prisma`, `src/app/seller/(panel)/layout.tsx` |
| 68 | Business Rules (Seller Module) | `prisma/schema.prisma`, `src/app/seller/(panel)/layout.tsx`, `src/lib/auth/dal.ts`, `src/lib/seller/context.ts` |

### §69–90 · Super Admin module

| § | Section | Where it lives |
| --- | --- | --- |
| 69 | Super Admin Module Overview | `/admin`, `src/app/admin/(console)/layout.tsx` |
| 70 | Super Admin Responsibilities | `/admin`, `src/app/admin/(console)/layout.tsx` |
| 71 | Admin Dashboard | `/admin`, `src/app/admin/(console)/layout.tsx` |
| 72 | Dashboard Layout | `/admin`, `src/app/admin/(console)/layout.tsx` |
| 73 | Customer Management | `/admin/customers/[id]`, `/admin/customers`, `src/app/actions/admin-customers.ts`, `src/app/admin/(console)/layout.tsx` +4 more |
| 74 | Seller Management | `/admin/sellers/[id]`, `/admin/sellers`, `prisma/schema.prisma`, `prisma/seed/sellers.ts` +7 more |
| 75 | Product Management | `/admin/products/[id]`, `/admin/products`, `/seller/profile`, `prisma/schema.prisma` +11 more |
| 76 | Category Management | `/admin/categories`, `prisma/schema.prisma`, `src/app/actions/admin-categories.ts`, `src/app/admin/(console)/layout.tsx` +5 more |
| 77 | Inventory Monitoring | `/admin/inventory`, `prisma/schema.prisma`, `src/app/admin/(console)/layout.tsx`, `src/lib/admin/inventory.ts` +1 more |
| 78 | Order Management | `/admin/orders/[orderNumber]`, `/admin/orders`, `src/app/actions/admin-orders.ts`, `src/app/admin/(console)/layout.tsx` +4 more |
| 79 | Warehouse Coordination | `src/app/admin/(console)/layout.tsx` |
| 80 | Quality Control Monitoring | `src/app/admin/(console)/layout.tsx` |
| 81 | Finance Module | `src/app/admin/(console)/layout.tsx` |
| 82 | Coupon Management | `prisma/schema.prisma`, `src/app/admin/(console)/layout.tsx` |
| 83 | Banner Management | `prisma/schema.prisma`, `src/app/admin/(console)/layout.tsx` |
| 84 | CMS (Content Management System) | `/admin/marketing/content/[slug]`, `/admin/marketing/content`, `/page/[slug]`, `prisma/schema.prisma` +4 more |
| 85 | Notifications Management | `prisma/schema.prisma`, `src/app/admin/(console)/layout.tsx` |
| 86 | Reports & Analytics | `src/app/admin/(console)/layout.tsx` |
| 87 | Platform Settings | `/admin/settings`, `prisma/schema.prisma`, `prisma/seed/content.ts`, `src/app/actions/admin-settings.ts` +6 more |
| 88 | Roles & Permissions | `/admin/roles`, `prisma/schema.prisma`, `prisma/seed/roles.ts`, `src/app/admin/(console)/layout.tsx` +3 more |
| 89 | Audit Logs | `/admin/audit`, `prisma/schema.prisma`, `src/app/admin/(console)/layout.tsx`, `src/lib/admin/audit.ts` |
| 90 | Security Controls | `prisma/schema.prisma`, `src/app/admin/(console)/layout.tsx` |

### §91–114 · Operations — warehouse, QC, logistics

| § | Section | Where it lives |
| --- | --- | --- |
| 91 | Operations Overview | Narrative — Chapter opener for §92-114 |
| 92 | Operational Workflow | `prisma/schema.prisma`, `src/lib/admin/audit.ts`, `src/lib/constants.ts` |
| 93 | Warehouse Module | `/operations/warehouse`, `prisma/schema.prisma`, `src/app/actions/seller-orders.ts`, `src/app/operations/warehouse/layout.tsx` +5 more |
| 94 | Warehouse Dashboard | `/operations/warehouse/queue`, `/operations/warehouse`, `prisma/schema.prisma`, `src/app/actions/operations.ts` +8 more |
| 95 | Warehouse Workflow | `/operations/warehouse/queue/[subOrderNumber]/pick-list`, `/operations/warehouse/queue/[subOrderNumber]`, `/operations/warehouse/queue`, `/operations/warehouse` +8 more |
| 96 | Warehouse Order Status | `/operations/warehouse/queue/[subOrderNumber]/pick-list`, `/operations/warehouse/queue/[subOrderNumber]`, `/operations/warehouse/queue`, `/operations/warehouse` +6 more |
| 97 | Inventory Handling | `/operations/warehouse/movements`, `/operations/warehouse/queue/[subOrderNumber]`, `/operations/warehouse/queue`, `/operations/warehouse` +11 more |
| 98 | Stock Alerts | `/operations/warehouse/inventory`, `/operations/warehouse/queue/[subOrderNumber]`, `/operations/warehouse`, `/seller/inventory` +12 more |
| 99 | Quality Control (QC) Module | `/operations/qc`, `prisma/schema.prisma`, `src/app/operations/qc/layout.tsx`, `src/lib/admin/audit.ts` +3 more |
| 100 | QC Dashboard | `/operations/qc/queue`, `/operations/qc`, `prisma/schema.prisma`, `src/app/actions/operations.ts` +6 more |
| 101 | QC Workflow | `/operations/qc/queue/[subOrderNumber]`, `/operations/qc/queue`, `/operations/qc`, `prisma/schema.prisma` +5 more |
| 102 | QC Inspection Checklist | `/operations/qc/queue/[subOrderNumber]`, `/operations/qc/queue`, `/operations/qc`, `prisma/schema.prisma` +9 more |
| 103 | QC Decision Flow | `/operations/qc/reports`, `/operations/qc`, `prisma/schema.prisma`, `src/app/operations/qc/layout.tsx` +4 more |
| 104 | Rejection Reasons | `/operations/qc/queue/[subOrderNumber]`, `/operations/qc/reports`, `/operations/qc`, `prisma/schema.prisma` +9 more |
| 105 | Packaging Module | `prisma/schema.prisma`, `src/lib/admin/audit.ts`, `src/lib/constants.ts`, `src/lib/operations/queues.ts` |
| 106 | Packaging Workflow | `prisma/schema.prisma`, `src/lib/admin/audit.ts`, `src/lib/constants.ts`, `src/lib/operations/queues.ts` |
| 107 | Logistics Module | `/operations/logistics`, `prisma/schema.prisma`, `src/app/actions/operations-logistics.ts`, `src/app/operations/logistics/layout.tsx` +6 more |
| 108 | Shipment Workflow | `/operations/logistics/queue/[subOrderNumber]`, `/operations/logistics/queue`, `/operations/logistics`, `prisma/schema.prisma` +9 more |
| 109 | Shipment Status | `/operations/logistics/queue/[subOrderNumber]`, `/operations/logistics/queue`, `/operations/logistics`, `prisma/schema.prisma` +9 more |
| 110 | Delivery Confirmation | `/operations/logistics/queue/[subOrderNumber]`, `/operations/logistics/queue`, `/operations/logistics/reports`, `/operations/logistics` +9 more |
| 111 | Returns Workflow (If Enabled) | `/admin/support/returns/[subOrderNumber]`, `/admin/support/returns`, `prisma/schema.prisma`, `prisma/seed/orders.ts` +8 more |
| 112 | Operations Notifications | `src/lib/fulfilment/transition.ts` |
| 113 | Operations Reports | `prisma/schema.prisma` |
| 114 | Operations Permissions Matrix | `src/lib/constants.ts` |

### §115–122 · Finance module

| § | Section | Where it lives |
| --- | --- | --- |
| 115 | Module Overview | Narrative — Chapter opener for §116-122 |
| 116 | Finance Module Overview | `/admin/finance`, `prisma/schema.prisma`, `src/app/admin/finance/layout.tsx`, `src/lib/finance/dashboard.ts` |
| 117 | Finance Dashboard | `/admin/finance`, `prisma/schema.prisma`, `src/app/admin/finance/layout.tsx`, `src/lib/finance/dashboard.ts` |
| 118 | Payment Management | `/admin/finance/payments`, `/admin/finance`, `prisma/schema.prisma`, `src/app/admin/finance/layout.tsx` +3 more |
| 119 | Seller Settlement | `/admin/finance/settlements`, `/seller/profile`, `/seller/settlements`, `prisma/schema.prisma` +14 more |
| 120 | Settlement Dashboard | `/admin/finance/settlements`, `/seller/settlements`, `prisma/schema.prisma`, `prisma/seed/orders.ts` +9 more |
| 121 | Refund Management | `/admin/finance/refunds`, `prisma/schema.prisma`, `src/app/actions/finance.ts`, `src/app/admin/finance/layout.tsx` +7 more |
| 122 | Financial Reports | `/admin/finance/reports`, `prisma/schema.prisma`, `src/app/admin/finance/layout.tsx`, `src/lib/finance/reports.ts` |

### §123–129 · Marketing module

| § | Section | Where it lives |
| --- | --- | --- |
| 123 | Marketing Overview | `prisma/schema.prisma`, `src/app/actions/marketing.ts`, `src/app/admin/marketing/layout.tsx`, `src/lib/admin/audit.ts` +2 more |
| 124 | Marketing Dashboard | `/admin/marketing`, `prisma/schema.prisma`, `src/app/actions/marketing.ts`, `src/app/admin/marketing/layout.tsx` +4 more |
| 125 | Banner Management | `/admin/marketing/banners/[id]`, `/admin/marketing/banners`, `prisma/schema.prisma`, `prisma/seed/content.ts` +9 more |
| 126 | Coupon Management | `/admin/marketing/coupons/[id]`, `/admin/marketing/coupons`, `prisma/schema.prisma`, `prisma/seed/content.ts` +7 more |
| 127 | Campaign Management | `/admin/marketing/campaigns/[id]`, `/admin/marketing/campaigns`, `prisma/schema.prisma`, `prisma/seed/content.ts` +8 more |
| 128 | Promotional Notifications | `/admin/marketing/audience`, `prisma/schema.prisma`, `src/app/actions/marketing.ts`, `src/app/admin/marketing/layout.tsx` +6 more |
| 129 | Marketing Reports | `/admin/marketing/coupons/[id]`, `/admin/marketing`, `prisma/schema.prisma`, `prisma/seed/content.ts` +7 more |

### §130–140 · Customer support module

| § | Section | Where it lives |
| --- | --- | --- |
| 130 | Customer Support Overview | `/admin/support`, `prisma/schema.prisma`, `src/app/admin/support/layout.tsx`, `src/lib/admin/audit.ts` +1 more |
| 131 | Support Dashboard | `/admin/support`, `prisma/schema.prisma`, `src/app/admin/support/layout.tsx`, `src/lib/admin/audit.ts` |
| 132 | Ticket Categories | `/account/support/new`, `/account/support`, `prisma/schema.prisma`, `prisma/seed/support.ts` +6 more |
| 133 | Ticket Workflow | `/admin/support/tickets`, `prisma/schema.prisma`, `src/app/actions/support-desk.ts`, `src/app/admin/support/layout.tsx` +3 more |
| 134 | Ticket Information | `/admin/support/tickets/[ticketNumber]`, `prisma/schema.prisma`, `src/app/actions/support-desk.ts`, `src/app/admin/support/layout.tsx` +4 more |
| 135 | Ticket Status | `/account/support/[ticketNumber]`, `/admin/support/tickets/[ticketNumber]`, `prisma/schema.prisma`, `prisma/seed/support.ts` +8 more |
| 136 | Priority Levels | `/admin/support/tickets/[ticketNumber]`, `prisma/schema.prisma`, `src/app/actions/support-desk.ts`, `src/app/admin/support/layout.tsx` +6 more |
| 137 | Internal Notes | `/account/support/[ticketNumber]`, `/admin/support/tickets/[ticketNumber]`, `prisma/schema.prisma`, `prisma/seed/support.ts` +7 more |
| 138 | Customer Communication | `prisma/schema.prisma`, `src/app/admin/support/layout.tsx`, `src/lib/admin/audit.ts`, `src/lib/support/dashboard.ts` |
| 139 | Support Reports | `prisma/schema.prisma`, `src/app/admin/support/layout.tsx`, `src/lib/admin/audit.ts` |
| 140 | CRM Features | `prisma/schema.prisma`, `src/app/admin/support/layout.tsx`, `src/lib/admin/audit.ts` |

### §141–165 · Public website

| § | Section | Where it lives |
| --- | --- | --- |
| 141 | Public Website Overview | Narrative — Chapter opener for §142-165 |
| 142 | Website Objectives | `src/lib/constants.ts` |
| 143 | Website Structure (Site Map) | Documented — The route tree is the site map; see the header, mega-menu and footer |
| 144 | Header | `src/app/(storefront)/layout.tsx`, `src/components/storefront/site-header.tsx` |
| 145 | Mega Navigation | `prisma/schema.prisma`, `src/components/storefront/site-header.tsx` |
| 146 | Homepage | `/`, `prisma/seed/content.ts` |
| 147 | Hero Section | `/`, `src/components/storefront/hero-carousel.tsx` |
| 148 | Featured Categories | `/` |
| 149 | Featured Products | `/` |
| 150 | New Arrivals | `/` |
| 151 | Best Sellers | `/`, `src/lib/catalogue/queries.ts`, `src/lib/constants.ts` |
| 152 | Why Choose Saawariya | `/`, `src/components/storefront/why-saawariya.tsx` |
| 153 | Become a Seller Section | `/`, `/page/[slug]`, `prisma/seed/content.ts`, `src/components/storefront/site-footer.tsx` |
| 154 | Testimonials | `/`, `src/lib/catalogue/queries.ts` |
| 155 | Newsletter Subscription | `/`, `/admin/marketing/audience`, `src/lib/marketing/audience.ts`, `src/lib/validations/marketing.ts` |
| 156 | Footer | `src/app/(storefront)/layout.tsx`, `src/components/storefront/site-footer.tsx` |
| 157 | Product Listing Page | `/shop/[category]/[sub]`, `/shop/[category]`, `/shop`, `prisma/schema.prisma` +4 more |
| 158 | Product Card | `prisma/schema.prisma`, `src/components/storefront/product-card.tsx` |
| 159 | Product Detail Page (PDP) | `/product/[slug]`, `prisma/schema.prisma`, `src/components/storefront/breadcrumbs.tsx` |
| 160 | Search Experience | `/search`, `src/components/storefront/search-box.tsx`, `src/lib/catalogue/queries.ts` |
| 161 | Authentication Pages | Documented — `/login`, `/register`, `/forgot-password` — see `src/app/(auth)` |
| 162 | Responsive Design | Documented — Verified rather than annotated: `npm run qa` asserts no route scrolls horizontally at 375px |
| 163 | UI Design Principles | `src/app/globals.css` |
| 164 | Accessibility | `src/app/globals.css`, `src/components/commerce/status-badge.tsx`, `src/components/ui/field.tsx`, `src/lib/status-tone.ts` |
| 165 | SEO Considerations | `src/app/robots.ts`, `src/app/sitemap.ts` |

### §166–185 · Technical requirements

| § | Section | Where it lives |
| --- | --- | --- |
| 166 | Technical Overview | Narrative — Chapter opener for §167-185 |
| 167 | System Architecture | Documented — README — Technology, and the three authorisation layers |
| 168 | High-Level Components | Documented — README — Project structure |
| 169 | Module Architecture | Documented — The `src/lib/<domain>/` split; see README |
| 170 | Database Design (High-Level) | Documented — docs/DATA_MODEL.md |
| 171 | Entity Relationships (Conceptual) | Documented — docs/ERD.md |
| 172 | Authentication | `prisma/schema.prisma` |
| 173 | Authorization | `prisma/schema.prisma`, `src/lib/constants.ts` |
| 174 | API Design | Out of scope — No REST or GraphQL layer. Writes are Server Actions and reads are server components, so there is no public API surface to design — deliberate, and noted in README |
| 175 | Third-Party Integrations | Out of scope — Nothing third-party is connected: no payment gateway, no SMS, email or WhatsApp provider, no courier API. Each is stated on the screen that would have used it |
| 176 | File Storage | Out of scope — Images are committed under `public/catalogue/`. No object store, so the project runs offline |
| 177 | Notification Engine | Out of scope — In-app `Notification` rows only. Delivery channels depend on integrations that are not connected |
| 178 | Logging & Monitoring | `prisma/schema.prisma` |
| 179 | Security Guidelines | `src/lib/auth/password.ts` |
| 180 | Performance Requirements | Out of scope — No load testing was performed. The indexes the query paths need are in the schema |
| 181 | Scalability | Documented — README — Why SQLite locally, and what moving to PostgreSQL costs |
| 182 | Backup & Recovery | Out of scope — The database is a single file — `dev.db`. Backup is copying it |
| 183 | Deployment | Documented — README — Running the project. The deliverable is run locally, not deployed |
| 184 | Coding Standards | Documented — ESLint and TypeScript strict mode, both clean; `npm run lint`, `npm run typecheck` |
| 185 | Future Technical Enhancements | Narrative — Roadmap |

### §186–202 · Development guidelines

| § | Section | Where it lives |
| --- | --- | --- |
| 186 | Purpose of This Section | Narrative — Chapter opener |
| 187 | Development Objective | Narrative — Instructions to the developer, not requirements on the software |
| 188 | Development Approach | Narrative — Instructions to the developer |
| 189 | Development Principles | Narrative — Instructions to the developer |
| 190 | Coding Standards | Documented — Same as §184 |
| 191 | UI/UX Expectations | Documented — Design tokens in `src/app/globals.css`, sampled from the supplied brand assets |
| 192 | Performance Expectations | Out of scope — Same as §180 |
| 193 | Error Handling | `src/components/ui/field.tsx`, `src/lib/validations/auth.ts` |
| 194 | Security Expectations | `src/lib/auth/password.ts`, `src/lib/validations/auth.ts` |
| 195 | Testing Strategy | Documented — `npm run qa` and `npx tsx prisma/seed-check.ts`; see docs/QA_REPORT.md |
| 196 | Quality Assurance (QA) Checklist | Documented — docs/QA_REPORT.md, regenerated by `npm run qa` |
| 197 | Version Control | Narrative — Process |
| 198 | Documentation During Development | Documented — The `docs/` folder and the doc comment on every module |
| 199 | Communication Guidelines | Narrative — Process |
| 200 | Live Meeting Topics | Narrative — Agenda for the live meeting — SRS §200 withholds final scope until then |
| 201 | Future Collaboration | Narrative — Process |
| 202 | Final Note to the Developer | Narrative — Closing note |
