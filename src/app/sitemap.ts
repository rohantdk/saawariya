import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { PUBLIC_PRODUCT_WHERE } from "@/lib/catalogue/queries";

/**
 * SRS §165. Every URL a signed-out visitor can actually reach — the same
 * PUBLIC_PRODUCT_WHERE the storefront queries filter on, so a product that
 * 404s never appears here either. Panels behind proxy.ts's PROTECTED_AREAS
 * are excluded, same list as robots.ts.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const [categories, products, cmsPages] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      select: { slug: true, parent: { select: { slug: true } } },
    }),
    prisma.product.findMany({
      where: PUBLIC_PRODUCT_WHERE,
      select: { slug: true, updatedAt: true },
    }),
    prisma.cmsPage.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/search`, changeFrequency: "weekly", priority: 0.5 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((category) => ({
    url: category.parent
      ? `${baseUrl}/shop/${category.parent.slug}/${category.slug}`
      : `${baseUrl}/shop/${category.slug}`,
    changeFrequency: "weekly",
    priority: category.parent ? 0.7 : 0.8,
  }));

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${baseUrl}/product/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const cmsRoutes: MetadataRoute.Sitemap = cmsPages.map((page) => ({
    url: `${baseUrl}/page/${page.slug}`,
    lastModified: page.updatedAt,
    changeFrequency: "monthly",
    priority: 0.3,
  }));

  return [
    ...staticRoutes,
    ...categoryRoutes,
    ...productRoutes,
    ...cmsRoutes,
  ];
}
