# Saawariya design system

The state of the interface as built, written down so a redesign has something
concrete to argue with. `src/app/globals.css` has pointed at this file since
Phase 0; this is that file.

Two audiences:

- **Designing a new look** — read *Tokens*, *Type* and *Components*, then
  *Constraints that must survive a redesign*. That last section is the only part
  that is not up for negotiation, and it is short.
- **Implementing one** — read *Where to change things*. Almost every visual
  decision resolves to one of four files.

Everything below is what the code does today, not an aspiration. Where a value
looks arbitrary, the reason is given.

---

## 1. Tokens

All tokens are Tailwind v4 `@theme` custom properties in `src/app/globals.css`.
Declaring them there is what makes `bg-brand-600`, `text-ink-400` and the rest
exist as utilities — there is no `tailwind.config.js`.

### Brand — maroon

Sampled from the supplied logo, not invented.

| Token | Hex | Used for |
| --- | --- | --- |
| `brand-50` | `#fdf5f4` | selected filter chips |
| `brand-100` | `#fae8e7` | |
| `brand-200` | `#f5d3d1` | |
| `brand-300` | `#ecb0ad` | |
| `brand-400` | `#de827e` | |
| `brand-500` | `#cc5852` | |
| **`brand-600`** | `#9e302f` | **the logo maroon — primary actions, links** |
| `brand-700` | `#832927` | primary hover |
| `brand-800` | `#6d2523` | primary active |
| **`brand-900`** | `#5a1f1f` | **wine — header, footer, hero panel** |
| `brand-950` | `#35100f` | announcement strip, craft band |

`brand-600` is the exact maroon of the logo field. If the palette changes, that
one has to be re-derived from the artwork or the lockup will sit wrong against
its own brand colour.

### Ivory — surfaces

| Token | Hex | Used for |
| --- | --- | --- |
| `ivory-50` | `#fdfcfa` | cards, raised surfaces |
| **`ivory-100`** | `#f8f5f1` | **page background** |
| `ivory-200` | `#f3efea` | image placeholders, ghost hover |
| `ivory-300` | `#e6dfd3` | inner dividers |
| **`ivory-400`** | `#e0dad1` | **borders and dividers** |
| `ivory-500` | `#cfc6b9` | disabled borders |

### Ink — text

Warm near-black. **Never pure black** — `#000` against these ivories reads cold
and separates from the photography.

| Token | Hex | Used for |
| --- | --- | --- |
| `ink-400` | `#70635c` | secondary text, meta, captions |
| `ink-500` | `#4a3d36` | body copy in long-form blocks |
| `ink-600` | `#362a24` | |
| **`ink-900`** | `#261c17` | **primary text, headings** |

### Gold — zari accent

Used sparingly and deliberately: hairlines, eyebrow rules, the "on the loom"
badge, active nav underlines. It is an accent, not a second brand colour — the
moment gold covers area rather than lines, the page starts to look like a
sweet-shop sign rather than a textile house.

| Token | Hex |
| --- | --- |
| `gold-300` | `#ddc796` |
| `gold-400` | `#c8a96a` |
| `gold-500` | `#ac8c4e` |
| `gold-600` | `#8a6f3c` |

### Semantic status

Each has a solid and a `-soft` background. These carry meaning across the order
pipeline, QC results and verification states, so they are **not** free to be
re-assigned for aesthetic reasons — see the constraint in §6.

| Token | Solid | Soft |
| --- | --- | --- |
| `success` | `#2f6b4f` | `#e8f2ec` |
| `warning` | `#a9731c` | `#fbf1e0` |
| `danger` | `#a32f2c` | `#fbeae9` |
| `info` | `#2f5a6b` | `#e8f0f2` |

`danger` and `brand-600` are close on purpose — both are reds in this palette —
but they are never adjacent in the same control.

### Elevation

```
--shadow-card:    0 1px 2px rgba(38,28,23,.04), 0 4px 12px rgba(38,28,23,.06)
--shadow-lifted:  0 2px 4px rgba(38,28,23,.05), 0 12px 28px rgba(38,28,23,.09)
```

Tinted with the ink colour, not black. Shadows are rare: the interface separates
surfaces with hairline borders, and reserves shadow for things that genuinely
float (mega-menu panel, mobile drawer).

### Motion

```
--ease-out-soft: cubic-bezier(0.22, 0.61, 0.36, 1)
```

One easing curve for everything. Durations run 200ms (colour) to 700ms (hero
cross-fade). Premium reads as calm — nothing bounces, nothing overshoots.

Every animation is disabled under `prefers-reduced-motion`, globally, at the
bottom of `globals.css`.

---

## 2. Type

Two families, both variable, both self-hosted by `next/font` — no external
requests and no layout shift. Declared in `src/app/layout.tsx`.

| Role | Family | Token |
| --- | --- | --- |
| Display — headings, prices, hero | **Bodoni Moda** | `font-display` |
| UI — body, forms, tables, panels | **Inter Tight** | `font-sans` |

**Why Bodoni.** The supplied wordmark is a high-contrast didone — flat
unbracketed serifs, extreme thick/thin. Bodoni Moda is the closest widely
available match, so a heading and the lockup beneath it read as one decision
rather than two. Its optical-size axis is what makes it usable at all: it thins
hairlines at display sizes and thickens them at 18px, which static Bodoni cannot
do and which is why most Bodoni on the web looks broken at body sizes.

**Do not set the display face below 16px.** Below that its hairlines drop out at
1× and it turns to mush. Small text is Inter Tight, always.

### Scale as used

`h1`–`h4` default to `font-display`, weight **700**, tracking `-0.02em`
(`h1`: `-0.03em`) via the base layer.

| Use | Classes | Renders |
| --- | --- | --- |
| Hero headline | `text-[2.5rem] sm:text-5xl lg:text-[3.75rem]` | 40 → 48 → 60px |
| Page title | `text-3xl sm:text-4xl` | 30 → 36px |
| Section heading | `text-3xl sm:text-[2rem]` | 30 → 32px |
| Card / block heading | `text-lg` – `text-2xl` | 18 – 24px |
| Product card title | `text-[0.9375rem]` | 15px |
| Body | `text-sm` (`text-base` in editorial) | 14px / 16px |
| Meta, captions | `text-xs` | 12px |
| Eyebrow, nav, buttons | `text-[0.6875rem]` | 11px |
| Badges, micro-labels | `text-[0.625rem]` | 10px |

Uppercase micro-type always carries wide tracking (`0.12em`–`0.2em`). Uppercase
at 10–11px without tracking is unreadable; the tracking is not decoration.

### The eyebrow

A signature of the brand voice — the gold-ruled label above section headings.
Defined once as `.eyebrow` in `globals.css`, drawn with `::before`/`::after`
rules.

```html
<p class="eyebrow">The Edit</p>
```

---

## 3. Components

77 components in `src/components/`, grouped by the area that owns them.

| Directory | Count | Scope |
| --- | --- | --- |
| `storefront/` | 26 | public site — header, hero, cards, filters, gallery |
| `commerce/` | 15 | cart, checkout, orders, addresses, tickets |
| `ui/` | 6 | shared primitives — button, field, badges, charts |
| `admin/`, `seller/`, `operations/`, `marketing/` | 26 | panel-specific forms and actions |
| `layout/` | 2 | the signed-in panel shell and its nav |
| `brand/` | 1 | the logo lockup |
| `support/` | 1 | ticket composer |

### Buttons — `ui/button.tsx`

Four variants, three sizes. **Square corners** (`rounded-none`) everywhere; the
interface has no rounded rectangles except avatars and filter chips.

| Variant | Appearance |
| --- | --- |
| `primary` | solid `brand-600`, ivory text |
| `secondary` | hairline border, transparent fill |
| `ghost` | no border, tinted hover |
| `danger` | solid `danger` |

| Size | Height | Type |
| --- | --- | --- |
| `sm` | 36px | 12px / `0.12em` |
| `md` | 44px | 12px / `0.14em` |
| `lg` | 52px | 14px / `0.16em` |

All button text is **uppercase, medium weight, wide tracking**. `ButtonLink` is
the same thing rendered as a `next/link`.

### Status badges — `commerce/status-badge.tsx`

Tones: `neutral`, `success`, `warning`, `danger`, `info`.

**The badge always renders the word, never colour alone.** Tone is emphasis, not
information. Tone maps live beside the labels they belong to
(`lib/commerce/order-status.ts`, `lib/status-tone.ts`) precisely so the same
state cannot be amber on one screen and red on the next.

### Product card — `storefront/product-card.tsx`

Fixed **3:4 crop, `object-cover`**, never letterboxed. The catalogue is museum
textile photography ranging from 900×2648 sari scans to wide border bands;
fitting those inside a box gives every card a different amount of dead space and
makes the best photographs look like the worst.

Badges stack top-left: discount → new → *on the loom* → low stock → sold out.
"On the loom" is **gold, not amber** — being woven to order is a mark of the
piece, not a fault with it.

### Filters — `storefront/filter-panel.tsx`

Colour and fabric render as **chips**; pattern, occasion and work stay as
checkbox rows. Chips suit the facets people shop *by*; rows suit the ones they
narrow *with*.

Colour chips carry a swatch **and the colour name**. They previously carried the
swatch alone with the name in a `title` attribute — invisible on touch, and
useless to anyone who cannot separate "Cream & Natural" from "White".

### Panel shell — `layout/panel-shell.tsx`

Every signed-in area (seller, admin, operations, finance, support) shares one
shell: ivory header with the maroon lockup, role label, sidebar nav. The panels
are **visually quieter than the storefront** — dense tables, no photography, no
display type below headings. They are tools, not a shopfront, and the two should
not converge.

---

## 4. Layout

- **Container**: `max-w-7xl` (80rem / 1280px), gutters `px-5` → `lg:px-8`.
- **Section rhythm**: `py-16` → `lg:py-20`, separated by `border-t border-ivory-400`.
- **Product grids**: 2 → 3 → 4 columns (`grid-cols-2 md:grid-cols-3 xl:grid-cols-4`), `gap-x-5 gap-y-9`.
- **Breakpoints**: Tailwind defaults. `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280.
- `lg` is the real hinge: the mega-menu, filter sidebar and split hero all appear there.

### The header

Three tiers that condense to two on scroll, driven by `data-scrolled` on the
header's group (`storefront/header-shell.tsx`):

1. announcement + utility links — collapses to zero height
2. lockup, search, account actions — 92px → 72px
3. category bar with mega-menu — never leaves; it is the navigation

Deep wine rather than ivory, because the mark is cream artwork drawn for a
maroon field. On an ivory bar it has to be recoloured to survive.

---

## 5. Where to change things

Nearly every visual decision lives in one of four places.

| To change | Edit |
| --- | --- |
| Any colour, shadow, easing | `src/app/globals.css` → `@theme` |
| Either typeface | `src/app/layout.tsx` (the `next/font` calls) |
| Heading weight, tracking, base styles | `src/app/globals.css` → `@layer base` |
| `.eyebrow`, nav underline, ribbon animation | `src/app/globals.css` → `@layer components` |
| Button shape and sizing | `src/components/ui/button.tsx` |
| Card crop and badges | `src/components/storefront/product-card.tsx` |
| Header structure | `src/components/storefront/site-header.tsx` + `header-shell.tsx` |
| The logo lockup | `src/components/brand/wordmark.tsx` |

Changing a token in `@theme` updates every utility that derives from it across
all 63 components. That is the intended way to re-skin the site; hand-editing
colours into components is how a palette drifts.

### Brand assets

`public/brand/` holds transparent PNGs cut from the supplied JPEG — the mark and
wordmark, each in a cream colourway for dark surfaces and a maroon one for light.
`assets/saawariya-logo.jpeg` is the original.

**Get a real vector from the designer.** These were reconstructed from a JPEG;
they are crisp at header sizes but the monogram carries compression artefacts if
enlarged. Swapping in an SVG means changing `wordmark.tsx` and nothing else.

---

## 6. Constraints that must survive a redesign

Everything above is open to change. These are not — each is load-bearing, and
breaking one is a functional regression rather than a style choice.

1. **Colour is never the only signal.** Every status badge prints its word.
   Every colour swatch carries its name. (SRS §164.)
2. **The focus ring stays visible.** `:focus-visible` is a 2px `brand-600`
   outline with 2px offset. The build is keyboard-navigable end to end; removing
   `outline: none` without an equal replacement breaks that.
3. **Filters work without JavaScript.** Every filter control is a plain link to
   the same page with a different query string. There is no client-side filter
   state, which is why the URL is always shareable and Back always works. A
   redesign that needs a JS-driven filter drawer must keep the links underneath.
4. **Search is a plain GET form.** Same reason. Do not reintroduce a
   `useSearchParams` prefill — there is a note in `search-box.tsx` explaining the
   Suspense bug that caused last time.
5. **Semantic colours keep their meanings.** Success/warning/danger/info map to
   order, QC and verification states across five panels. Re-assigning them for
   looks means an evaluator learns the colour means nothing.
6. **Motion respects `prefers-reduced-motion`.** The carousel does not
   auto-advance, and all transitions collapse to ~0ms.
7. **Content is database-driven.** Banners, categories, products, testimonials
   and cluster copy all come from rows. A mockup showing different counts or
   copy does not change the page — it changes the seed or the query, and that
   needs saying explicitly.
8. **Empty states are real states.** Every rail and grid has one, and several
   are visible in the seeded demo on purpose. A redesign that only draws the
   full case leaves them unstyled.

---

## 7. Current screens

`docs/screenshots/` — 91 PNGs at 2× covering every route pattern across all ten
personas, plus three at 375px. `index.html` in that directory shows the set on
one page. Regenerate with `npm run screenshots` (needs `npm run dev` running).

These are the correct base to redesign over. The `Saawariya-Screens/` folder at
the repository root is an older export and is **stale** — it predates the wine
header, the Bodoni pairing, the cluster pages and the specification block.
