/**
 * No "use client" here on purpose: `theme-script.tsx` is a Server Component
 * and needs this string at server-render time. A constant exported from a
 * "use client" module is replaced with a client-reference stub when read on
 * the server, so the value has to live in a plain module both sides can
 * import directly.
 */
export const THEME_STORAGE_KEY = "saawariya-theme";
