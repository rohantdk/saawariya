import type { MetadataRoute } from "next";

/**
 * SRS §165. The storefront is the only part of the site meant to be indexed.
 * The disallow list mirrors proxy.ts's PROTECTED_AREAS prefixes plus its
 * AUTH_ROUTES — kept as a literal copy rather than an import, since this is
 * an advisory file for crawlers, not the security boundary, and importing
 * from proxy.ts would pull session-decryption code into a route that has no
 * need of it.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account",
        "/seller",
        "/admin",
        "/operations",
        "/login",
        "/register",
        "/forgot-password",
        "/cart",
        "/checkout",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
