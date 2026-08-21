import type { Metadata } from "next";
import { Bodoni_Moda, Inter_Tight } from "next/font/google";
import { ThemeScript } from "@/components/theme/theme-script";
import "./globals.css";

/**
 * Bodoni Moda carries the brand voice (headings, prices, hero copy). It is the
 * closest widely-available match to the didone lettering of the supplied logo —
 * same high stroke contrast, same flat unbracketed serifs — so a heading and the
 * wordmark beneath it read as one typographic family rather than two decisions.
 * Its optical-size axis is what makes it usable: it thins the hairlines at
 * display sizes and thickens them at 18px, which plain Bodoni cannot do.
 *
 * Inter Tight carries everything functional (body, forms, dashboards, tables).
 * The tighter cut sits better against a high-contrast serif than stock Inter,
 * and it keeps the operational screens legible at small sizes.
 *
 * Both are variable and self-hosted by next/font — no external requests, no
 * layout shift, and every weight from 400 to 900 available at no extra cost.
 */
const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  display: "swap",
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
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
      suppressHydrationWarning
      className={`${bodoni.variable} ${interTight.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
