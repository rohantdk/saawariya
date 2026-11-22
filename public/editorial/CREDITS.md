# Editorial image credits

These are the styled set pieces used in the homepage hero, the wholesale strip
and the craft band. They are separate from `public/catalogue/`, which holds
product photography tied to specific listings.

## Provenance — read before launch

Unlike `public/catalogue/`, **these files do not have a verified licence.**

They were copied from the client's own earlier prototype site on 2026-08-16.
Their original author, source and terms of use are not stated anywhere on that
site, so their provenance cannot be verified.

That is fine for a prototype and for internal review. It is **not** settled
enough to launch on, for two reasons:

1. **Rights are undetermined.** Whoever produced them may or may not hold usable
   rights, and the terms they were produced under have not been checked. Confirm
   with Team ARJITAY that these are theirs to use commercially before the site
   goes public.
2. **They depict people.** Three of them show identifiable-looking models. If any
   were based on real likenesses, that is a personality-rights
   exposure in India regardless of the copyright position.

The rest of this build deliberately uses only CC0 and public-domain imagery with
each source recorded (see `public/catalogue/CREDITS.md`). These files are the one
exception, and they are isolated in this directory so they are easy to swap out
in one place: the paths are referenced from `EDITORIAL` in
`prisma/seed/content.ts` and from `src/components/storefront/craft-band.tsx`.

## Files

| File | Used for | Source |
| --- | --- | --- |
| `hero-bridal.jpg` | Hero slide 1 — "The Vivaah Bridal Edit" | client prototype, original file `16fcdd1bd_1519965f` |
| `silk-sanctuary.jpg` | Hero slide 2 — "Chanderi, Woven Light" | client prototype, original file `dce4d0013_36f9b5a6` |
| `bridal-atelier.jpg` | Wholesale strip — "Buying for a boutique?" | client prototype, original file `90613b0e8_2506fcbd` |
| `handloom-craft.jpg` | Craft band — main frame | client prototype, original file `8baec843a_9a6c1ea9` |
| `banarasi-heritage.jpg` | Craft band — inset | client prototype, original file `7b8165f0c_56f05d97` |
| `festive-reverie.jpg` | Not currently placed | client prototype, original file `f279a163e_295b9031` |
| `bridal-story.jpg` | Not currently placed | client prototype, original file `9f69f76fa_82bab4a9` |

### Added 2026-08-21

A second pass took the pages the 2026-08-16 pass had not visited (`/shop`,
`/collections`, `/craftsmanship`). **Same source, same unresolved licence —
everything above applies to these too**, and two of them depict people.

| File | Used for | Source |
| --- | --- | --- |
| `zari-brocade-texture.jpg` | CATEGORY_TOP banner — "Fabric by the Metre" | client prototype, original file `0a527e5a8_7ccbcc4e` |
| `festive-diwali.jpg` | Hero slide 4 — "Dressed for the Season" | client prototype, original file `d15a690d8_a273821a` |
| `weaver-pit-loom.jpg` | HOME_STRIP banner — "Handloom Week" | client prototype, original file `78ea08a83_39ea7c50` |
| `weaver-woman.jpg` | Craft band — inset | client prototype, original file `473651ccb_1899757c` |

`zari-brocade-texture.jpg` is the only one of the four with no person in it.

Five further frames from the same pass went to `public/catalogue/` and are
attached to product listings — see `public/catalogue/CREDITS.md`. Those carry
a sharper version of the same risk, because they sit on a product page as
photographs of goods for sale.

Two images from that pass were deliberately **not** used:
`c319d7e6f` has "LUXE SAREE COLLECTION" burned into the pixels, so it cannot be
relabelled for one of our categories; `20dbbd60b` had no place to go. Neither
is included in this build; both remain on the client's prototype site if they
are ever wanted.

The last two are kept because they are usable and the client may want them, but
nothing renders them today. Delete them if they are not going to be used.

### Added 2026-08-24 — supplied directly by the client

`client-hero-saree.jpg` is **not** from the prototype site — everything above about
unresolved provenance does not apply to it. It was supplied
directly by the client as `herosareepic.png` in
`D:\Arjitay Project\saree-images\` (the same folder as the five product
photographs behind the live catalogue — see `public/catalogue/CREDITS.md`)
and used for the homepage hero as of that date. Same open question as the
catalogue photos, though: no commercial usage rights were stated when the
files were handed over — confirm with the client before this build goes
anywhere public.

| File | Used for | Source |
| --- | --- | --- |
| `client-hero-saree.jpg` | Hero slide 1 — "The Vivaah Bridal Edit" | Client-supplied, `saree-images/herosareepic.png` |

## Processing

Downloaded as PNG (1.2–1.7 MB each) and re-encoded to JPEG at quality 82 with
mozjpeg and 4:4:4 chroma, which took the set from 10.4 MB to 0.9 MB with no
visible loss on the zari detail. Shipping the PNGs would have made the homepage
hero alone a 1.5 MB download.
