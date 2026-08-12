import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

/**
 * Playfair Display carries the brand voice (headings, prices, hero copy).
 * Inter carries everything functional (body, forms, dashboards, tables).
 * Both are self-hosted by next/font — no external requests, no layout shift.
 */
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Saawariya — Premium Indian Textile Marketplace",
    template: "%s | Saawariya",
  },
  description:
    "Discover handwoven sarees, dress materials and fine fabrics from verified Indian textile manufacturers. Retail and wholesale, on one trusted marketplace.",
  openGraph: {
    type: "website",
    siteName: "Saawariya",
    title: "Saawariya — Premium Indian Textile Marketplace",
    description:
      "Handwoven sarees, dress materials and fine fabrics from verified Indian textile manufacturers.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
