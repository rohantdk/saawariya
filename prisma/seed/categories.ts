import type { PrismaClient } from "../../src/generated/prisma/client";
import { CATALOGUE_IMAGES } from "./images";

/**
 * The category tree behind the Shop mega-menu (SRS §157) and the listing
 * facets (SRS §40).
 *
 * Two levels only. The schema supports arbitrary depth via Category.parentId,
 * but a mega-menu that renders "department -> product type" is what the SRS
 * describes, and deeper nesting would give the client a menu nobody can use.
 *
 * `slug` is the stable key — seeding upserts on it, so re-running never
 * duplicates rows and never breaks a URL that has already been shared.
 */

type CategorySeed = {
  slug: string;
  name: string;
  description: string;
  iconName: string;
  image: string;
  children: Array<{ slug: string; name: string; description: string; image: string }>;
};

const IMG = CATALOGUE_IMAGES;

export const CATEGORY_TREE: CategorySeed[] = [
  {
    slug: "sarees",
    name: "Sarees",
    description:
      "Handwoven and handcrafted sarees from India's principal weaving centres — Varanasi, Kanchipuram, Chanderi, Murshidabad and Pochampally.",
    iconName: "Sparkles",
    image: IMG.banarasi[0],
    children: [
      {
        slug: "banarasi-sarees",
        name: "Banarasi Sarees",
        description:
          "Varanasi brocade woven with gold and silver zari, in the kadhwa and cutwork traditions.",
        image: IMG.banarasi[1],
      },
      {
        slug: "kanjivaram-sarees",
        name: "Kanjivaram Sarees",
        description:
          "Heavy mulberry silk from Kanchipuram with contrast korvai borders and temple motifs.",
        image: IMG.kanjivaram[0],
      },
      {
        slug: "silk-sarees",
        name: "Silk Sarees",
        description:
          "Mulberry, tussar and Assam silk sarees for weddings, receptions and ceremony.",
        image: IMG.silk[0],
      },
      {
        slug: "cotton-sarees",
        name: "Cotton Sarees",
        description:
          "Breathable handloom cotton and mulmul for daily wear, office and summer.",
        image: IMG.cotton[0],
      },
      {
        slug: "chanderi-sarees",
        name: "Chanderi Sarees",
        description:
          "Sheer silk-cotton from Madhya Pradesh, light enough to fold into a matchbox.",
        image: IMG.chanderi[0],
      },
      {
        slug: "bandhani-ikat-sarees",
        name: "Bandhani & Ikat",
        description:
          "Resist-dyed Gujarati bandhani and yarn-dyed Pochampally and Patola ikat.",
        image: IMG.ikat[0],
      },
    ],
  },
  {
    slug: "suits-kurtis",
    name: "Suits & Kurtis",
    description:
      "Stitched and semi-stitched salwar suits, anarkalis and kurtis in cotton, silk and georgette.",
    iconName: "Shirt",
    image: IMG.suits[0],
    children: [
      {
        slug: "anarkali-suits",
        name: "Anarkali Suits",
        description: "Floor-length flared anarkalis for festive and reception wear.",
        image: IMG.suits[1],
      },
      {
        slug: "straight-suits",
        name: "Straight Suits",
        description: "Straight-cut kameez sets with matching salwar and dupatta.",
        image: IMG.suits[2],
      },
      {
        slug: "kurtis",
        name: "Kurtis",
        description: "Everyday and office kurtis in printed cotton, rayon and linen.",
        image: IMG.suits[3],
      },
      {
        slug: "dress-materials",
        name: "Dress Materials",
        description:
          "Unstitched three-piece sets — top, bottom and dupatta — for tailoring to fit.",
        image: IMG.blockprint[0],
      },
    ],
  },
  {
    slug: "lehengas",
    name: "Lehengas",
    description:
      "Bridal and occasion lehenga cholis with zardozi, mirror and sequin work.",
    iconName: "Crown",
    image: IMG.lehenga[0],
    children: [
      {
        slug: "bridal-lehengas",
        name: "Bridal Lehengas",
        description:
          "Heavily worked bridal sets in velvet, raw silk and organza with full ghera.",
        image: IMG.lehenga[1],
      },
      {
        slug: "party-lehengas",
        name: "Party Lehengas",
        description: "Lighter lehengas for sangeet, mehendi and reception.",
        image: IMG.lehenga[2],
      },
    ],
  },
  {
    slug: "dupattas-stoles",
    name: "Dupattas & Stoles",
    description:
      "Phulkari, bandhani and Banarasi dupattas, plus silk and pashmina-weave stoles.",
    iconName: "Wind",
    image: IMG.phulkari[0],
    children: [
      {
        slug: "phulkari-dupattas",
        name: "Phulkari Dupattas",
        description:
          "Punjabi darn-stitch floral embroidery worked in floss silk on khadi.",
        image: IMG.phulkari[1],
      },
      {
        slug: "banarasi-dupattas",
        name: "Banarasi Dupattas",
        description: "Zari-woven dupattas to pair with plain suits and lehengas.",
        image: IMG.brocade[0],
      },
      {
        slug: "silk-stoles",
        name: "Silk Stoles & Shawls",
        description: "Kashmir-weave shawls and light silk stoles with boteh motifs.",
        image: IMG.shawl[0],
      },
    ],
  },
  {
    slug: "fabric-by-the-metre",
    name: "Fabric by the Metre",
    description:
      "Running fabric sold by the metre for tailoring and bulk buying — the wholesale core of the catalogue.",
    iconName: "Scissors",
    image: IMG.brocade[1],
    children: [
      {
        slug: "silk-fabric",
        name: "Silk Fabric",
        description: "Mulberry, tussar and raw silk yardage in plain and shot colours.",
        image: IMG.silk[1],
      },
      {
        slug: "cotton-fabric",
        name: "Cotton Fabric",
        description: "Handloom cotton, khadi and mulmul by the metre.",
        image: IMG.cotton[1],
      },
      {
        slug: "brocade-fabric",
        name: "Brocade & Zari",
        description:
          "Benares and Surat brocade with supplementary-weft gold and silver work.",
        image: IMG.brocade[2],
      },
      {
        slug: "block-print-fabric",
        name: "Block Print & Chintz",
        description:
          "Hand block-printed and chintz-painted cotton from Bagru, Sanganer and the Coromandel.",
        image: IMG.blockprint[1],
      },
      {
        slug: "kalamkari-fabric",
        name: "Kalamkari",
        description:
          "Pen-drawn and block-printed kalamkari using natural mordant dyes.",
        image: IMG.kalamkari[0],
      },
    ],
  },
  {
    slug: "mens-ethnic",
    name: "Men's Ethnic",
    description: "Kurtas, Nehru jackets and dhotis in handloom cotton and silk.",
    iconName: "User",
    image: IMG.mens[0],
    children: [
      {
        slug: "mens-kurtas",
        name: "Kurtas",
        description: "Straight and pathani kurtas in khadi, cotton and tussar.",
        image: IMG.mens[1],
      },
      {
        slug: "nehru-jackets",
        name: "Nehru Jackets",
        description: "Brocade and raw-silk bandhgala jackets to layer over kurtas.",
        image: IMG.brocade[3],
      },
      {
        slug: "dhoti-angavastram",
        name: "Dhoti & Angavastram",
        description: "Temple-border dhotis and angavastrams in fine cotton.",
        image: IMG.cotton[2],
      },
    ],
  },
  {
    slug: "home-textiles",
    name: "Home Textiles",
    description:
      "Cushion covers, table linen, bed linen and wall hangings in the same handloom traditions.",
    iconName: "Home",
    image: IMG.kalamkari[1],
    children: [
      {
        slug: "cushion-covers",
        name: "Cushion Covers",
        description: "Block-print, brocade and embroidered covers in standard sizes.",
        image: IMG.blockprint[2],
      },
      {
        slug: "table-linen",
        name: "Table Linen",
        description: "Runners, mats and napkins in handloom cotton and kalamkari.",
        image: IMG.kalamkari[2],
      },
      {
        slug: "bed-linen",
        name: "Bed Linen",
        description: "Bedcovers and quilts in block-printed and jamdani-woven cotton.",
        image: IMG.jamdani[0],
      },
      {
        slug: "wall-hangings",
        name: "Wall Hangings",
        description: "Framed and unframed textile panels, including phulkari bagh work.",
        image: IMG.phulkari[2],
      },
    ],
  },
];

export async function seedCategories(prisma: PrismaClient) {
  let parents = 0;
  let children = 0;

  for (const [index, parent] of CATEGORY_TREE.entries()) {
    const parentRow = await prisma.category.upsert({
      where: { slug: parent.slug },
      update: {
        name: parent.name,
        description: parent.description,
        iconName: parent.iconName,
        imageUrl: parent.image,
        sortOrder: index,
        isActive: true,
      },
      create: {
        slug: parent.slug,
        name: parent.name,
        description: parent.description,
        iconName: parent.iconName,
        imageUrl: parent.image,
        sortOrder: index,
      },
    });
    parents++;

    for (const [childIndex, child] of parent.children.entries()) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: {
          name: child.name,
          description: child.description,
          imageUrl: child.image,
          parentId: parentRow.id,
          sortOrder: childIndex,
          isActive: true,
        },
        create: {
          slug: child.slug,
          name: child.name,
          description: child.description,
          imageUrl: child.image,
          parentId: parentRow.id,
          sortOrder: childIndex,
        },
      });
      children++;
    }
  }

  console.log(`  Categories: ${parents} top-level, ${children} sub-categories`);
}
