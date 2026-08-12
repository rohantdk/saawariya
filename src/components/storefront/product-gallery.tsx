"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Product gallery.
 *
 * The main frame is 3:4 and cropped, matching the cards, so the image a visitor
 * clicked is the image they land on. The catalogue is museum textile
 * photography with wildly inconsistent source ratios — a 900×2648 sari scan and
 * a wide border band cannot share a letterboxed frame without one of them
 * looking broken.
 */
export function ProductGallery({
  images,
  productName,
}: {
  images: { id: string; url: string; alt: string }[];
  productName: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[3/4] items-center justify-center bg-ivory-200 text-sm text-ink-400">
        No photography available
      </div>
    );
  }

  const active = images[Math.min(activeIndex, images.length - 1)];

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      {images.length > 1 && (
        <ul className="flex gap-3 sm:w-20 sm:flex-col">
          {images.map((image, index) => (
            <li key={image.id} className="flex-1 sm:flex-none">
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-current={index === activeIndex}
                className={cn(
                  "relative block aspect-[3/4] w-full overflow-hidden border-2 transition-colors",
                  index === activeIndex
                    ? "border-brand-600"
                    : "border-transparent hover:border-ivory-500",
                )}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="5rem"
                  className="object-cover"
                />
                <span className="sr-only">
                  View image {index + 1} of {productName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative aspect-[3/4] flex-1 overflow-hidden bg-ivory-200">
        <Image
          key={active.id}
          src={active.url}
          alt={active.alt}
          fill
          priority
          sizes="(min-width: 1024px) 32rem, 100vw"
          className="object-cover"
        />
      </div>
    </div>
  );
}
