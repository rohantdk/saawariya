"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  as?: "div" | "section" | "li";
  className?: string;
  /** ms — stagger siblings by passing an increasing delay down a list. */
  delay?: number;
  /** px the content rises from as it fades in. */
  y?: number;
};

/**
 * Fades and rises content into place the first time it scrolls into view.
 * One IntersectionObserver per instance, disconnected after the first
 * intersection — this reveals, it does not toggle back out on scroll-up, so
 * re-reading the page never re-triggers the motion.
 *
 * prefers-reduced-motion is handled globally in globals.css (it zeroes every
 * transition-duration), so this component does not need its own check.
 */
export function Reveal({
  children,
  as: Tag = "div",
  className,
  delay = 0,
  y = 24,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      // Tells the automatic revealer in reveal-main.tsx to leave this subtree
      // alone — a hand-placed reveal always wins over the blanket one.
      data-reveal-item=""
      className={cn(
        "transition-[opacity,transform] duration-700 ease-[var(--ease-out-soft)]",
        className,
      )}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : `translateY(${y}px)`,
        transitionDelay: delay ? `${delay}ms` : undefined,
      }}
    >
      {children}
    </Tag>
  );
}
