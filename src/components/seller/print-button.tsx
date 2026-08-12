"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Opens the browser's print dialogue, which is also how the seller saves the
 * slip as a PDF. A client component purely because `window.print()` needs one —
 * the document it prints is entirely server-rendered.
 */
export function PrintButton() {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      <Printer aria-hidden="true" className="h-4 w-4" />
      Print or save as PDF
    </Button>
  );
}
