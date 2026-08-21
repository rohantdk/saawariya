"use client";

import { useEffect, useState } from "react";

/**
 * The thin strip above the header, cycling through the platform's standing
 * promises.
 *
 * Every line is passed in from settings the admin panel actually writes — the
 * free-shipping threshold, the dispatch window, the returns window — so this
 * cannot drift into advertising terms the checkout does not honour.
 *
 * It stops rotating under prefers-reduced-motion and while the tab is hidden,
 * and it is marked aria-live="off" with the full set rendered for assistive
 * technology once: a strip that re-announces itself every six seconds is worse
 * than one that does not move at all.
 */
export function AnnouncementRibbon({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      if (document.hidden) return;
      setIndex((current) => (current + 1) % messages.length);
    }, 5200);

    return () => clearInterval(timer);
  }, [messages.length]);

  if (messages.length === 0) return null;

  return (
    <p className="relative overflow-hidden text-[0.6875rem] tracking-[0.08em] text-cream/75">
      {/* Reserves the width of the longest line so the strip does not reflow
          around it as the message changes. */}
      <span aria-hidden="true" className="invisible block whitespace-nowrap">
        {messages.reduce((a, b) => (b.length > a.length ? b : a))}
      </span>

      <span
        // `key` restarts the rise-in animation on every change.
        key={index}
        aria-hidden="true"
        className="ribbon-line absolute inset-0 whitespace-nowrap"
      >
        {messages[index]}
      </span>

      <span className="sr-only">{messages.join(". ")}</span>
    </p>
  );
}
